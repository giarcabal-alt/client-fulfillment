import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { CandidateStatus, NextAction } from "@/lib/talent-acquisition/cadence";
import {
  STATUS_BADGE_LABELS,
  STATUS_BADGE_STYLES,
} from "@/lib/talent-acquisition/status-styles";

export function CandidateCard({
  name,
  roleTitle,
  action,
  status,
  onClick,
}: {
  name: string;
  roleTitle: string | null;
  action: NextAction;
  status: CandidateStatus;
  onClick: () => void;
}) {
  return (
    <Card
      onClick={onClick}
      className="cursor-pointer gap-1.5 p-3 transition-colors hover:border-work-blue"
    >
      <div className="truncate font-medium">{name}</div>
      <div className="truncate text-sm text-muted-foreground">
        {roleTitle ?? "No role set"}
      </div>
      <div className="truncate text-xs text-muted-foreground">
        {action.label}
      </div>
      <Badge className={cn("max-w-full truncate", STATUS_BADGE_STYLES[status])}>
        {STATUS_BADGE_LABELS[status](action)}
      </Badge>
    </Card>
  );
}
