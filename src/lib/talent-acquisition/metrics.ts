// ATS_FEATURES.md Step 7: time-in-stage + decline-reason metrics. Both are
// pure, DB-free functions (same discipline as skill-location-normalize.ts/
// resume-parse-core.ts's finalizeSkillChips) — the page component does the
// Supabase fetch and hands raw rows in here.

const MOVED_TO_PATTERN = /^Moved to (.+)$/;

// candidates-actions.ts's updateCandidateStage is the only writer of
// candidate_history, and it always inserts `label: `Moved to ${stage}``
// (no separate "from"/"to" columns exist, and none are being added here —
// ATS_FEATURES.md Step 7 explicitly says no new schema). This is the only
// shape ever written, so a label that doesn't match is either a future
// change to that writer or a manually-inserted row — either way, treat it
// as unparseable rather than guessing.
export function parseStageFromHistoryLabel(label: string): string | null {
  const match = label.match(MOVED_TO_PATTERN);
  return match ? match[1] : null;
}

export type StageHistoryEvent = {
  candidateId: string;
  stage: string;
  occurredAt: string;
};

export type StageDurationStat = {
  stage: string;
  avgDays: number;
  transitionCount: number;
};

// A candidate's stage timeline is reconstructed entirely from consecutive
// "Moved to X" events, sorted by time: the interval between one event and
// the next is time spent in the FIRST event's stage (they entered it at
// that timestamp, and left it — for whatever stage came next — at the
// second event's timestamp). This has two deliberate blind spots, both
// unavoidable given "no new schema":
//   1. The stage a candidate started in at creation (before their first
//      recorded move) is never counted — there's no history row marking
//      when they entered it, only ones marking when they left.
//   2. A candidate's CURRENT stage (after their last recorded move, or if
//      they've never moved at all) is never counted — this is exactly the
//      "exclude the open-ended current stage" requirement, and falls out
//      naturally: the last event in a candidate's sorted list has no
//      "next" event to pair it with.
// A candidate that bounces back into a stage it already passed through
// contributes a separate completed interval each time — `transitionCount`
// is a count of completed passes-through, not a count of distinct
// candidates (documented in the UI copy, not just here).
export function computeTimeInStage(
  events: StageHistoryEvent[]
): StageDurationStat[] {
  const byCandidate = new Map<string, StageHistoryEvent[]>();
  for (const event of events) {
    const list = byCandidate.get(event.candidateId) ?? [];
    list.push(event);
    byCandidate.set(event.candidateId, list);
  }

  const daysByStage = new Map<string, number[]>();
  for (const candidateEvents of byCandidate.values()) {
    const sorted = [...candidateEvents].sort(
      (a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt)
    );
    for (let i = 0; i < sorted.length - 1; i++) {
      const startMs = Date.parse(sorted[i].occurredAt);
      const endMs = Date.parse(sorted[i + 1].occurredAt);
      const days = (endMs - startMs) / 86_400_000;
      // Defensive only — occurred_at is server-set (`default now()`), so
      // out-of-order timestamps shouldn't occur, but a negative interval
      // would silently corrupt the average if one ever did.
      if (days < 0) continue;
      const stage = sorted[i].stage;
      const list = daysByStage.get(stage) ?? [];
      list.push(days);
      daysByStage.set(stage, list);
    }
  }

  return [...daysByStage.entries()].map(([stage, days]) => ({
    stage,
    avgDays: days.reduce((sum, d) => sum + d, 0) / days.length,
    transitionCount: days.length,
  }));
}

export type DeclineReasonStat = {
  reason: string;
  count: number;
};

// Groups case-insensitively ("Culture fit" and "culture fit" count
// together) but displays whichever casing was seen first for that group —
// picking a single canonical display form isn't asked for, and guessing
// one (e.g. always capitalizing) risks looking like a typo of what the
// recruiter actually typed.
export function computeDeclineReasonBreakdown(
  reasons: (string | null)[]
): DeclineReasonStat[] {
  const byKey = new Map<string, { display: string; count: number }>();
  for (const raw of reasons) {
    const trimmed = raw?.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    const existing = byKey.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      byKey.set(key, { display: trimmed, count: 1 });
    }
  }

  return [...byKey.values()]
    .map(({ display, count }) => ({ reason: display, count }))
    .sort((a, b) => b.count - a.count);
}
