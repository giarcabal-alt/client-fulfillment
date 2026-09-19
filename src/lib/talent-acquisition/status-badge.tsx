import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { CandidateStatus, NextAction } from "./cadence";
import {
  STATUS_BADGE_DOT,
  STATUS_BADGE_LABELS,
  STATUS_BADGE_STYLES,
} from "./status-styles";

// Single render for the status chip, used by the board card, board drawer,
// and candidate detail page — pulled out so a status's accent dot (see
// STATUS_BADGE_DOT) is drawn consistently everywhere instead of being
// hand-copied at each call site.
export function StatusBadge({
  status,
  action,
  className,
}: {
  status: CandidateStatus;
  action: NextAction;
  className?: string;
}) {
  const dotColor = STATUS_BADGE_DOT[status];
  return (
    <Badge className={cn(STATUS_BADGE_STYLES[status], className)}>
      {dotColor && (
        <span
          aria-hidden="true"
          className={cn("size-1.5 shrink-0 rounded-full", dotColor)}
        />
      )}
      <span className="truncate">{STATUS_BADGE_LABELS[status](action)}</span>
    </Badge>
  );
}
