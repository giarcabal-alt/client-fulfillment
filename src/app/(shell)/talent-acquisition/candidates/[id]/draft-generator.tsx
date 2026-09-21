"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { generateSuggestedMessage } from "@/lib/talent-acquisition/draft-actions";

export function DraftGenerator({
  candidateId,
  initialDraft,
}: {
  candidateId: string;
  initialDraft: string | null;
}) {
  const [extraContext, setExtraContext] = useState("");
  const [draft, setDraft] = useState(initialDraft);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function generate() {
    setError(null);
    startTransition(async () => {
      const result = await generateSuggestedMessage(
        candidateId,
        extraContext.trim() || undefined
      );
      if (result.error) {
        setError(result.error);
        return;
      }
      setDraft(result.content);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="draft-extra-context"
          className="text-xs uppercase tracking-wide text-muted-foreground"
        >
          Anything to include (optional)
        </label>
        <Textarea
          id="draft-extra-context"
          value={extraContext}
          onChange={(e) => setExtraContext(e.target.value)}
          disabled={isPending}
          rows={2}
          placeholder={`Something the candidate said, or a tweak like "make it shorter"`}
        />
      </div>

      <Button
        type="button"
        onClick={generate}
        disabled={isPending}
        aria-label="Generate suggested message"
        className="w-fit"
      >
        {isPending
          ? "Generating…"
          : draft
            ? "Regenerate suggested message"
            : "Generate suggested message"}
      </Button>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {draft && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            Suggested message
          </span>
          <pre className="whitespace-pre-wrap rounded-md border border-border bg-warm-paper p-3 font-sans text-sm text-slate-text">
            {draft}
          </pre>
        </div>
      )}
    </div>
  );
}
