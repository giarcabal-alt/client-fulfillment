import { SectionDivider } from "@/components/ui/section";
import { DraftGenerator } from "./draft-generator";

// The "Outreach" tab: the Next Action label + its scripted template sit
// directly above the AI Suggested Message generator, since both answer
// the same question — "what do I send this person" — rather than living
// in two separate cards a scroll apart, per the density-and-layout task.
// Server-renderable; DraftGenerator (the only interactive piece) is
// rendered as a client-component child.
export function OutreachPanel({
  candidateId,
  actionLabel,
  script,
  initialDraft,
}: {
  candidateId: string;
  actionLabel: string;
  script: string | null;
  initialDraft: string | null;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-muted-foreground">Next action</span>
        <p className="text-sm">{actionLabel}</p>
        {script ? (
          <pre className="whitespace-pre-wrap rounded-md border border-border bg-warm-paper p-3 font-sans text-sm text-slate-text">
            {script}
          </pre>
        ) : (
          <p className="text-sm text-muted-foreground">
            No scripted template at this stage.
          </p>
        )}
      </div>

      <SectionDivider />

      <DraftGenerator candidateId={candidateId} initialDraft={initialDraft} />
    </div>
  );
}
