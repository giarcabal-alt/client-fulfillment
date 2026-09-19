import { Card } from "@/components/ui/card";
import type { CandidateStatus, NextAction } from "@/lib/talent-acquisition/cadence";
import { StatusBadge } from "@/lib/talent-acquisition/status-badge";
import { STATUS_BADGE_LABELS } from "@/lib/talent-acquisition/status-styles";

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
    <Card className="gap-0 p-0 transition-colors hover:border-work-blue">
      {/* Card (src/components/ui/card.tsx) is a plain div with no
          polymorphic `render` prop, so the real interactive element is a
          native <button> filling it — the correct fix for keyboard/screen
          reader access, not the plain onClick div this replaces. */}
      <button
        type="button"
        onClick={onClick}
        aria-label={`Open ${name}${roleTitle ? `, ${roleTitle}` : ""} — ${STATUS_BADGE_LABELS[status](action)}`}
        className="flex w-full cursor-pointer flex-col gap-1.5 p-3 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <div className="truncate font-medium">{name}</div>
        <div className="truncate text-sm text-muted-foreground">
          {roleTitle ?? "No role set"}
        </div>
        <div className="truncate text-xs text-muted-foreground">
          {action.label}
        </div>
        <StatusBadge status={status} action={action} className="max-w-full" />
      </button>
    </Card>
  );
}
