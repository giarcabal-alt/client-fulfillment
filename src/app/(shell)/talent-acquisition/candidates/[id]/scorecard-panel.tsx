"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { BOARD_STAGES } from "@/lib/talent-acquisition/cadence";
import { addScorecard } from "@/lib/talent-acquisition/scorecard-actions";

export type Scorecard = {
  id: string;
  rating: number;
  notes: string | null;
  stageAtReview: string;
  interviewerName: string | null;
  createdAt: string;
};

function stageLabelFor(value: string) {
  return BOARD_STAGES.find((s) => s.key === value)?.label ?? value;
}

function RatingDots({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          className={
            n <= rating
              ? "h-2 w-2 rounded-full bg-work-blue"
              : "h-2 w-2 rounded-full border border-border"
          }
        />
      ))}
    </span>
  );
}

function ScorecardForm({ candidateId }: { candidateId: string }) {
  const [rating, setRating] = useState("5");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await addScorecard(candidateId, Number(rating), notes);
      if (result.error) {
        setError(result.error);
      } else {
        setRating("5");
        setNotes("");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-end">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            Rating
          </span>
          <Select value={rating} onValueChange={(v) => v && setRating(v)} disabled={isPending}>
            <SelectTrigger aria-label="Rating" className="sm:w-28">
              <SelectValue>{(value: string) => `${value}/5`}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4, 5].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}/5
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="scorecard-notes"
          className="text-xs uppercase tracking-wide text-muted-foreground"
        >
          Notes
        </label>
        <Textarea
          id="scorecard-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={isPending}
          rows={3}
          placeholder="What stood out from this interview?"
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <Button type="submit" disabled={isPending} className="w-fit">
        {isPending ? "Saving…" : "Add scorecard"}
      </Button>
    </form>
  );
}

export function ScorecardPanel({
  candidateId,
  scorecards,
}: {
  candidateId: string;
  scorecards: Scorecard[];
}) {
  return (
    <div className="flex flex-col gap-4">
      <ScorecardForm candidateId={candidateId} />

      <div className="flex flex-col gap-2">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          Past scorecards
        </span>
        {scorecards.length === 0 ? (
          <p className="text-sm text-muted-foreground">No scorecards yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {scorecards.map((s) => (
              <li
                key={s.id}
                className="flex flex-col gap-1.5 rounded-md border border-border p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <RatingDots rating={s.rating} />
                    <span className="text-sm font-medium text-ink-navy">
                      {s.rating}/5
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(s.createdAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </div>
                {s.notes && (
                  <p className="whitespace-pre-wrap text-sm text-slate-text">
                    {s.notes}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  {stageLabelFor(s.stageAtReview)}
                  {s.interviewerName ? ` · ${s.interviewerName}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
