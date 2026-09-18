"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  BOARD_STAGES,
  nextActionFor,
  statusFor,
  type CandidateStage,
} from "@/lib/talent-acquisition/cadence";
import { CandidateCard } from "./candidate-card";
import { CandidateDrawer } from "./candidate-drawer";
import { NewCandidateForm } from "./new-candidate-form";

/**
 * Native OS/browser scrollbars render inconsistently (auto-hidden until
 * hover/scroll, or suppressed entirely depending on OS "show scrollbars"
 * settings), giving no reliable cue that the board has more columns
 * off-screen. This tracks scroll position/extent so we can render our own
 * always-visible, on-brand indicator instead of depending on native theming.
 */
function useHorizontalScrollThumb(ref: React.RefObject<HTMLDivElement | null>) {
  const [thumb, setThumb] = useState<{ leftPct: number; widthPct: number } | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = () => {
      const { scrollWidth, clientWidth, scrollLeft } = el;
      if (scrollWidth <= clientWidth + 1) {
        setThumb(null);
        return;
      }
      const widthPct = (clientWidth / scrollWidth) * 100;
      const maxScroll = scrollWidth - clientWidth;
      const leftPct = (scrollLeft / maxScroll) * (100 - widthPct);
      setThumb({ leftPct, widthPct });
    };

    update();
    el.addEventListener("scroll", update, { passive: true });
    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      resizeObserver.disconnect();
    };
  }, [ref]);

  return thumb;
}

export type BoardCandidate = {
  id: string;
  name: string;
  stage: CandidateStage;
  stage_entered_at: string;
  last_action_at: string | null;
  touch_index: number;
  tags: string | null;
  roleTitle: string | null;
};

export function BoardClient({
  candidates,
  roles,
}: {
  candidates: BoardCandidate[];
  roles: { id: string; title: string }[];
}) {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollThumb = useHorizontalScrollThumb(scrollRef);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return candidates;
    return candidates.filter((c) =>
      [c.name, c.roleTitle ?? "", c.tags ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [search, candidates]);

  const columns = useMemo(() => {
    return BOARD_STAGES.map((stage) => {
      const inStage = filtered
        .filter((c) => c.stage === stage.key)
        .map((c) => {
          const action = nextActionFor(c);
          return { candidate: c, action, status: statusFor(c, action) };
        })
        .sort((a, b) => (a.action.due ?? Infinity) - (b.action.due ?? Infinity));
      return { stage, cards: inStage };
    });
  }, [filtered]);

  const selected = useMemo(() => {
    if (!selectedId) return null;
    const candidate = candidates.find((c) => c.id === selectedId);
    if (!candidate) return null;
    const action = nextActionFor(candidate);
    return { candidate, action, status: statusFor(candidate, action) };
  }, [selectedId, candidates]);

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-hidden">
      <div className="flex items-center justify-between gap-4">
        <Input
          placeholder="Search by name, role, or tag…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Button onClick={() => setAddOpen(true)} className="shrink-0">
          + New Candidate
        </Button>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display text-lg text-ink-navy">
              New Candidate
            </DialogTitle>
          </DialogHeader>
          <NewCandidateForm roles={roles} onSuccess={() => setAddOpen(false)} />
        </DialogContent>
      </Dialog>

      <div className="flex flex-1 flex-col gap-2 overflow-hidden">
        <div ref={scrollRef} className="board-scrollbar flex flex-1 gap-3 overflow-x-auto">
        {columns.map(({ stage, cards }) => (
          <div key={stage.key} className="min-w-[140px] flex-1">
            <div className="flex items-center justify-between rounded-t-lg border border-b-0 border-border bg-stone px-3 py-2">
              <span className="min-w-0 flex-1 truncate font-display text-sm text-ink-navy">
                {stage.label}
              </span>
              <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                {cards.length}
              </span>
            </div>
            <div className="flex min-h-32 flex-col gap-2 rounded-b-lg border border-border bg-warm-paper p-2">
              {cards.length === 0 && (
                <p className="p-2 text-sm italic text-muted-foreground">
                  No one here yet
                </p>
              )}
              {cards.map(({ candidate, action, status }) => (
                <CandidateCard
                  key={candidate.id}
                  name={candidate.name}
                  roleTitle={candidate.roleTitle}
                  action={action}
                  status={status}
                  onClick={() => setSelectedId(candidate.id)}
                />
              ))}
            </div>
          </div>
        ))}
        </div>
        {scrollThumb && (
          <div
            className="h-1.5 w-full shrink-0 overflow-hidden rounded-full bg-stone"
            aria-hidden="true"
          >
            <div
              className="h-full rounded-full bg-ink-navy/35"
              style={{
                marginLeft: `${scrollThumb.leftPct}%`,
                width: `${scrollThumb.widthPct}%`,
              }}
            />
          </div>
        )}
      </div>

      {selected && (
        <CandidateDrawer
          candidate={selected.candidate}
          action={selected.action}
          status={selected.status}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}
