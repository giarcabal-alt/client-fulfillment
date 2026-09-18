// Shared status badge presentation — pulled out once a third place (the
// candidate detail page) needed the same overdue/soon/ok/done/parked
// styling as the board card and drawer.

import type { CandidateStatus, NextAction } from "./cadence";

export const STATUS_BADGE_STYLES: Record<CandidateStatus, string> = {
  overdue: "bg-destructive text-white",
  soon: "bg-sun-gold text-ink-navy",
  ok: "bg-growth-green text-white",
  done: "bg-stone text-slate-text",
  parked: "bg-stone text-slate-text",
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
