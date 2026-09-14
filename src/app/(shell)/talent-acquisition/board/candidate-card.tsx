import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { CandidateStatus, NextAction } from "@/lib/talent-acquisition/cadence";

const STATUS_STYLES: Record<CandidateStatus, string> = {
  overdue: "bg-destructive text-white",
  soon: "bg-sun-gold text-ink-navy",
  ok: "bg-growth-green text-white",
  done: "bg-stone text-slate-text",
  parked: "bg-stone text-slate-text",
};

const STATUS_LABELS: Record<CandidateStatus, (action: NextAction) => string> = {
  overdue: (action) => `Overdue — was due ${fmtDate(action.due)}`,
  soon: (action) => `Due ${fmtDate(action.due)}`,
  ok: (action) => `On track — due ${fmtDate(action.due)}`,
  done: () => "No action due",
  parked: () => "Parked",
};

function fmtDate(due: number | null) {
  if (!due) return "";
  return new Date(due).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

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
      <div className="font-medium">{name}</div>
      <div className="text-sm text-muted-foreground">
        {roleTitle ?? "No role set"}
      </div>
      <div className="text-xs text-muted-foreground">{action.label}</div>
      <Badge className={cn("w-fit", STATUS_STYLES[status])}>
        {STATUS_LABELS[status](action)}
      </Badge>
    </Card>
  );
}
