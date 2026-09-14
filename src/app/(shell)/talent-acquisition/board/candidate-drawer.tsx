"use client";

import { useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  BOARD_STAGES,
  type CandidateStatus,
  type NextAction,
} from "@/lib/talent-acquisition/cadence";
import { updateCandidateStage } from "@/lib/talent-acquisition/candidates-actions";
import type { BoardCandidate } from "./board-client";

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

export function CandidateDrawer({
  candidate,
  action,
  status,
  onClose,
}: {
  candidate: BoardCandidate;
  action: NextAction;
  status: CandidateStatus;
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();

  function handleStageChange(next: string | null) {
    if (!next || next === candidate.stage) return;
    startTransition(async () => {
      await updateCandidateStage(candidate.id, next);
    });
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle className="font-display text-lg text-ink-navy">
            {candidate.name}
          </SheetTitle>
          <SheetDescription>
            {candidate.roleTitle ?? "No role set"}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              Stage
            </span>
            <Select
              value={candidate.stage}
              onValueChange={handleStageChange}
              disabled={isPending}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BOARD_STAGES.map((s) => (
                  <SelectItem key={s.key} value={s.key}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              Next action
            </span>
            <Badge className={cn("w-fit", STATUS_STYLES[status])}>
              {STATUS_LABELS[status](action)}
            </Badge>
            <p className="text-sm">{action.label}</p>
          </div>

          <p className="text-sm text-muted-foreground">
            Notes, tags, and role reassignment live on the full candidate
            profile — coming soon.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
