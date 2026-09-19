// Shared status badge presentation — pulled out once a third place (the
// candidate detail page) needed the same overdue/soon/ok/done/parked
// styling as the board card and drawer.

import type { CandidateStatus, NextAction } from "./cadence";

export const STATUS_BADGE_STYLES: Record<CandidateStatus, string> = {
  overdue: "bg-destructive text-white",
  // Sun Gold is a sparing accent only — DESIGN.md's Five Percent Rule bans
  // it as a background or fill of any size, so "soon" stays on the same
  // neutral chip as done/parked and gets its gold via a small accent dot
  // instead (see STATUS_BADGE_DOT + its render sites), not a full fill.
  soon: "bg-stone text-ink-navy",
  ok: "bg-growth-green text-white",
  done: "bg-stone text-slate-text",
  parked: "bg-stone text-slate-text",
};

// Optional small accent dot rendered before a badge's label — the correct
// way to use Sun Gold on a status chip (a genuine "sparing accent," not a
// fill). Only "soon" has one; every other status is fully conveyed by its
// existing color + label.
export const STATUS_BADGE_DOT: Partial<Record<CandidateStatus, string>> = {
  soon: "bg-sun-gold",
};

export const STATUS_BADGE_LABELS: Record<
  CandidateStatus,
  (action: NextAction) => string
> = {
  overdue: (action) => `Overdue — was due ${formatDueDate(action.due)}`,
  soon: (action) => `Due ${formatDueDate(action.due)}`,
  ok: (action) => `On track — due ${formatDueDate(action.due)}`,
  done: () => "No action due",
  parked: () => "Parked",
};

export function formatDueDate(due: number | null) {
  if (!due) return "";
  return new Date(due).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
