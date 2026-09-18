"use client";

import Link from "next/link";
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
import {
  STATUS_BADGE_LABELS,
  STATUS_BADGE_STYLES,
} from "@/lib/talent-acquisition/status-styles";
import type { BoardCandidate } from "./board-client";

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
            <Badge className={cn("w-fit", STATUS_BADGE_STYLES[status])}>
              {STATUS_BADGE_LABELS[status](action)}
            </Badge>
            <p className="text-sm">{action.label}</p>
          </div>

          <Link
            href={`/talent-acquisition/candidates/${candidate.id}`}
            className="w-fit text-sm text-work-blue underline"
          >
            View full profile →
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  );
}
