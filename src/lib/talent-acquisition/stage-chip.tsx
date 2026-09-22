import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { BOARD_STAGES, type CandidateStage } from "./cadence";

// A separate small component from StatusBadge on purpose — StatusBadge
// encodes cadence *urgency* (overdue/soon/on-track/parked), which has no
// meaning for a rejected candidate or for a plain "what stage are they at"
// glance on the Talent Bench grid. This is pure stage *identity*: the
// canonical stage label (same BOARD_STAGES mapping already fixed for the
// Stage dropdown's closed-state display bug — see PROJECT_STATE.md §10)
// in a neutral tone, or a visually distinct "Rejected" when the
// candidate's lifecycle `status` (not `stage`) is 'rejected'.
function stageLabelFor(value: string) {
  return BOARD_STAGES.find((s) => s.key === value)?.label ?? value;
}

export function StageChip({
  stage,
  status,
  className,
}: {
  stage: CandidateStage;
  status: "active" | "rejected";
  className?: string;
}) {
  if (status === "rejected") {
    return (
      <Badge variant="destructive" className={cn("w-fit", className)}>
        Rejected
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className={cn("w-fit", className)}>
      {stageLabelFor(stage)}
    </Badge>
  );
}
