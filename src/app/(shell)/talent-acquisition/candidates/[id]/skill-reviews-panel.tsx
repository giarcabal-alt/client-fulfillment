"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { createPortal } from "react-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  confirmSkillReview,
  mapSkillReview,
  rejectSkillReview,
} from "@/lib/talent-acquisition/skill-review-actions";

export type PendingSkillReview = {
  id: string;
  rawText: string;
  suggestedSkillId: string | null;
  suggestedSkillName: string | null;
  similarity: number | null;
};

// Skill search results are capped — a searchable select doesn't need to
// show the entire org skill list at once, just enough to find the right
// one quickly.
const MAX_SEARCH_RESULTS = 8;

function SkillSearchCombobox({
  skills,
  onPick,
  disabled,
  label,
}: {
  skills: { id: string; name: string }[];
  onPick: (skillId: string) => void;
  disabled: boolean;
  label: string;
}) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const listboxId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [position, setPosition] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = q
      ? skills.filter((s) => s.name.toLowerCase().includes(q))
      : skills;
    return matches.slice(0, MAX_SEARCH_RESULTS);
  }, [query, skills]);

  // Portaled to document.body (below) rather than rendered inline, since
  // this combobox lives inside a Card and an inline-positioned dropdown
  // gets clipped by the card's box — the same category of bug as the
  // board's scroll-clipping issue, just manifesting as clipping instead
  // of scrolling. Position is tracked in viewport coordinates (`fixed`)
  // and recomputed on scroll/resize so it stays pinned to the input.
  useEffect(() => {
    if (!isOpen) return;
    function updatePosition() {
      const rect = inputRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPosition({ top: rect.bottom, left: rect.left, width: rect.width });
    }
    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [isOpen]);

  function pick(skillId: string) {
    setIsOpen(false);
    setQuery("");
    onPick(skillId);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIsOpen(true);
      setHighlightedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const match = results[highlightedIndex];
      if (match) pick(match.id);
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  }

  const optionId = (skillId: string) => `${listboxId}-${skillId}`;

  return (
    <div className="flex flex-col gap-1.5">
      <Input
        ref={inputRef}
        role="combobox"
        aria-label={label}
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={
          isOpen && results[highlightedIndex] ? optionId(results[highlightedIndex].id) : undefined
        }
        value={query}
        placeholder="Search skills…"
        disabled={disabled}
        onChange={(e) => {
          setQuery(e.target.value);
          setIsOpen(true);
          setHighlightedIndex(0);
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => {
          // Deferred so a click on an option (which blurs the input first)
          // still registers before the listbox unmounts.
          setTimeout(() => setIsOpen(false), 150);
        }}
        onKeyDown={handleKeyDown}
      />
      {isOpen &&
        results.length > 0 &&
        position &&
        createPortal(
          <ul
            id={listboxId}
            role="listbox"
            aria-label={label}
            style={{
              position: "fixed",
              top: position.top + 4,
              left: position.left,
              width: position.width,
            }}
            className="z-50 max-h-48 overflow-y-auto rounded-md border border-border bg-popover py-1 shadow-md"
          >
            {results.map((skill, i) => (
              <li key={skill.id} role="presentation">
                {/* Not an independent tab stop — a combobox's options are
                    selected via aria-activedescendant while focus stays on
                    the input (ArrowDown/Up/Enter above), the same reason the
                    hidden file input elsewhere on this page uses
                    tabIndex={-1} rather than being reachable on its own. */}
                <button
                  id={optionId(skill.id)}
                  type="button"
                  role="option"
                  tabIndex={-1}
                  aria-selected={i === highlightedIndex}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(skill.id)}
                  className={
                    i === highlightedIndex
                      ? "w-full px-3 py-1.5 text-left text-sm bg-accent text-accent-foreground"
                      : "w-full px-3 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                  }
                >
                  {skill.name}
                </button>
              </li>
            ))}
          </ul>,
          document.body
        )}
    </div>
  );
}

function SkillReviewRow({
  review,
  skills,
}: {
  review: PendingSkillReview;
  skills: { id: string; name: string }[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [isMapping, setIsMapping] = useState(false);
  const [isPending, startTransition] = useTransition();

  function confirm() {
    setError(null);
    startTransition(async () => {
      const result = await confirmSkillReview(review.id);
      if (result.error) setError(result.error);
    });
  }

  function reject() {
    setError(null);
    startTransition(async () => {
      const result = await rejectSkillReview(review.id);
      if (result.error) setError(result.error);
    });
  }

  function mapTo(skillId: string) {
    setError(null);
    startTransition(async () => {
      const result = await mapSkillReview(review.id, skillId);
      if (result.error) {
        setError(result.error);
      } else {
        setIsMapping(false);
      }
    });
  }

  return (
    <li className="flex flex-col gap-2 rounded-md border border-border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-ink-navy">{review.rawText}</span>
        {review.suggestedSkillName ? (
          <Badge variant="secondary">
            Suggested: {review.suggestedSkillName}
            {review.similarity != null
              ? ` · ${Math.round(review.similarity * 100)}% match`
              : ""}
          </Badge>
        ) : (
          <Badge variant="outline">No match — possibly a new skill</Badge>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {review.suggestedSkillId && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={confirm}
            disabled={isPending}
            aria-label={`Confirm ${review.rawText} as ${review.suggestedSkillName}`}
          >
            Confirm
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setIsMapping((v) => !v)}
          disabled={isPending}
          aria-label={`Map ${review.rawText} to a different skill`}
          aria-expanded={isMapping}
        >
          Map to different skill
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={reject}
          disabled={isPending}
          aria-label={`Reject ${review.rawText}`}
        >
          Reject
        </Button>
      </div>

      {isMapping && (
        <SkillSearchCombobox
          skills={skills}
          onPick={mapTo}
          disabled={isPending}
          label={`Search skills to map ${review.rawText} to`}
        />
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </li>
  );
}

export function SkillReviewsPanel({
  reviews,
  skills,
}: {
  reviews: PendingSkillReview[];
  skills: { id: string; name: string }[];
}) {
  if (reviews.length === 0) {
    return <p className="text-sm text-muted-foreground">No pending skill reviews.</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {reviews.map((review) => (
        <SkillReviewRow key={review.id} review={review} skills={skills} />
      ))}
    </ul>
  );
}
