// Ported from the prototype's STAGE_CONFIG / nextActionFor / statusFor
// (recruiting-desk.html) — same touch/recurring-reminder math, adapted to
// snake_case candidate columns instead of the prototype's in-memory object.
// Pure functions: candidate row + now in, next action + status out.

const DAY = 86_400_000;

export const CANDIDATE_STAGES = [
  "talent_pool",
  "sourced",
  "contacted",
  "phone_screen",
  "interviewing",
  "offer",
  "onboarding",
] as const;

export type CandidateStage = (typeof CANDIDATE_STAGES)[number];

// Column order for the board — Talent Pool first, then the pipeline stages
// in order (BUILD_BRIEF.md §7).
export const BOARD_STAGES: { key: CandidateStage; label: string }[] = [
  { key: "talent_pool", label: "Talent Pool" },
  { key: "sourced", label: "Sourced" },
  { key: "contacted", label: "Contacted" },
  { key: "phone_screen", label: "Phone Screen" },
  { key: "interviewing", label: "Interviewing" },
  { key: "offer", label: "Offer" },
  { key: "onboarding", label: "Onboarding" },
];

export type CandidateForCadence = {
  stage: CandidateStage;
  stage_entered_at: string;
  last_action_at: string | null;
  touch_index: number;
};

export type NextAction = {
  label: string;
  script: string | null;
  due: number | null;
  terminal: boolean;
};

export type CandidateStatus = "overdue" | "soon" | "ok" | "done" | "parked";

type Touch = { day: number; label: string; script: string };

type StageConfig = {
  touches: Touch[];
  exhaustedLabel?: string;
  recurDays?: number;
  recurLabel?: string;
  recurScript?: string;
};

// Talent Pool intentionally has no touches and no recurDays — no reminder
// pressure on parked candidates is a deliberate design choice (see
// docs/PROJECT_STATE.md "DO NOT TOUCH"), not an oversight.
export const STAGE_CONFIG: Record<CandidateStage, StageConfig> = {
  talent_pool: {
    touches: [],
    exhaustedLabel: "Parked in Talent Pool",
  },
  sourced: {
    touches: [
      { day: 0, label: "Send initial outreach", script: "coldOutreach" },
    ],
  },
  contacted: {
    touches: [
      { day: 3, label: "Send follow-up #1", script: "followup1" },
      { day: 8, label: "Send follow-up #2 (breakup)", script: "followup2" },
    ],
    exhaustedLabel: "No response yet — reply-check manually or archive",
  },
  phone_screen: {
    touches: [
      {
        day: 0,
        label: "Send scheduling note + prep call script",
        script: "phoneScreenScript",
      },
      { day: 1, label: "Send post-call thank-you", script: "postScreenThankYou" },
    ],
    recurDays: 6,
    recurLabel: "Send status update (even with no news)",
    recurScript: "statusUpdate",
  },
  interviewing: {
    touches: [],
    recurDays: 6,
    recurLabel: "Send status update (even with no news)",
    recurScript: "statusUpdate",
  },
  offer: {
    touches: [
      {
        day: 0,
        label: "Call with verbal offer, then send written offer",
        script: "verbalOffer",
      },
      { day: 2, label: "Check in if no response", script: "offerCheckin1" },
      {
        day: 4,
        label: "Second check-in / deadline reminder",
        script: "offerCheckin2",
      },
    ],
    exhaustedLabel: "Awaiting decision — check in by phone",
  },
  onboarding: {
    touches: [
      { day: 0, label: "Send acceptance confirmation", script: "acceptanceConfirm" },
      { day: 3, label: "Pre-start check-in", script: "preStartCheckin" },
      { day: 7, label: "Day 1 welcome message", script: "day1Welcome" },
      { day: 14, label: "End of Week 1 check-in", script: "week1Checkin" },
      { day: 44, label: "30-day check-in", script: "day30Checkin" },
      { day: 74, label: "60-day check-in", script: "day60Checkin" },
      { day: 104, label: "90-day check-in", script: "day90Checkin" },
    ],
    exhaustedLabel: "Onboarding complete ✓",
  },
};

export function nextActionFor(candidate: CandidateForCadence): NextAction {
  const cfg = STAGE_CONFIG[candidate.stage];
  const touches = cfg.touches;
  const stageEnteredAt = new Date(candidate.stage_entered_at).getTime();

  if (candidate.touch_index < touches.length) {
    const touch = touches[candidate.touch_index];
    return {
      label: touch.label,
      script: touch.script,
      due: stageEnteredAt + touch.day * DAY,
      terminal: false,
    };
  }

  if (cfg.recurDays) {
    const lastActionAt = candidate.last_action_at
      ? new Date(candidate.last_action_at).getTime()
      : stageEnteredAt;
    return {
      label: cfg.recurLabel!,
      script: cfg.recurScript!,
      due: lastActionAt + cfg.recurDays * DAY,
      terminal: false,
    };
  }

  return {
    label: cfg.exhaustedLabel ?? "No pending action",
    script: null,
    due: null,
    terminal: true,
  };
}

// Talent Pool always shows a neutral "parked" badge rather than overdue —
// this is checked before the action-based logic, not derived from it.
export function statusFor(
  candidate: CandidateForCadence,
  action: NextAction,
  now: number = Date.now()
): CandidateStatus {
  if (candidate.stage === "talent_pool") return "parked";
  if (action.terminal || action.due === null) return "done";
  if (action.due < now) return "overdue";
  if (action.due < now + 2 * DAY) return "soon";
  return "ok";
}
