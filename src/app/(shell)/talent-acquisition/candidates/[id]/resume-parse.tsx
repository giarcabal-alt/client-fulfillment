"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { parseResume } from "@/lib/talent-acquisition/resume-parse-actions";

// Explicit "Parse Resume" action (ATS_FEATURES.md Step 3: "triggered
// after a resume upload, or via an explicit action — your call") rather
// than auto-running on every upload: parsing spends a real Anthropic API
// call, and the schema's own review-queue design ("nothing auto-tags
// silently") argues for the recruiter deciding when to run it, not it
// firing invisibly the moment a file lands.
export function ResumeParse({
  candidateId,
  hasResume,
}: {
  candidateId: string;
  hasResume: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function parse() {
    setError(null);
    setSummary(null);
    startTransition(async () => {
      const result = await parseResume(candidateId);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.result) {
        const { skillsAutoMatched, skillsForReview, locationMatched, locationRaw } =
          result.result;
        const parts = [
          `${skillsAutoMatched} skill${skillsAutoMatched === 1 ? "" : "s"} matched`,
          `${skillsForReview} sent for review`,
        ];
        if (locationRaw) {
          parts.push(locationMatched ? `location matched: ${locationRaw}` : `location "${locationRaw}" needs manual review`);
        }
        setSummary(parts.join(" · "));
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={parse}
        disabled={isPending || !hasResume}
        aria-label="Parse resume"
        className="w-fit"
      >
        {isPending ? "Parsing…" : "Parse resume"}
      </Button>

      {summary && <p className="text-sm text-slate-text">{summary}</p>}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
