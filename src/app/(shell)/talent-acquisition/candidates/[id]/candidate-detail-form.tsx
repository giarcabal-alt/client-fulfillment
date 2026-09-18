"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  BOARD_STAGES,
  type CandidateStage,
} from "@/lib/talent-acquisition/cadence";
import {
  reassignCandidateRole,
  updateCandidateNotes,
  updateCandidateStage,
  updateCandidateTags,
} from "@/lib/talent-acquisition/candidates-actions";

const NO_ROLE_VALUE = "none";

type Candidate = {
  id: string;
  stage: CandidateStage;
  notes: string | null;
  tags: string | null;
  role_id: string | null;
};

export function CandidateDetailForm({
  candidate,
  roles,
}: {
  candidate: Candidate;
  roles: { id: string; title: string }[];
}) {
  const [stage, setStage] = useState<CandidateStage>(candidate.stage);
  const [roleId, setRoleId] = useState<string>(
    candidate.role_id ?? NO_ROLE_VALUE
  );
  const [notes, setNotes] = useState(candidate.notes ?? "");
  const [tags, setTags] = useState(candidate.tags ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleStageChange(next: string | null) {
    if (!next || next === stage) return;
    const previous = stage;
    setStage(next as CandidateStage);
    setError(null);
    startTransition(async () => {
      const result = await updateCandidateStage(candidate.id, next);
      if (result.error) {
        setError(result.error);
        setStage(previous);
      }
    });
  }

  function handleRoleChange(next: string | null) {
    if (!next || next === roleId) return;
    const previous = roleId;
    setRoleId(next);
    setError(null);
    startTransition(async () => {
      const result = await reassignCandidateRole(
        candidate.id,
        next === NO_ROLE_VALUE ? null : next
      );
      if (result.error) {
        setError(result.error);
        setRoleId(previous);
      }
    });
  }

  function saveNotes() {
    if (notes.trim() === (candidate.notes ?? "")) return;
    setError(null);
    startTransition(async () => {
      const result = await updateCandidateNotes(candidate.id, notes);
      if (result.error) setError(result.error);
    });
  }

  function saveTags() {
    if (tags.trim() === (candidate.tags ?? "")) return;
    setError(null);
    startTransition(async () => {
      const result = await updateCandidateTags(candidate.id, tags);
      if (result.error) setError(result.error);
    });
  }

  function roleLabelFor(value: string) {
    if (value === NO_ROLE_VALUE) return "No role — Talent Pool";
    return roles.find((role) => role.id === value)?.title ?? value;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            Stage
          </span>
          <Select
            value={stage}
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
            Role
          </span>
          <Select
            value={roleId}
            onValueChange={handleRoleChange}
            disabled={isPending}
          >
            <SelectTrigger>
              <SelectValue>{(value: string) => roleLabelFor(value)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_ROLE_VALUE}>
                No role — Talent Pool
              </SelectItem>
              {roles.map((role) => (
                <SelectItem key={role.id} value={role.id}>
                  {role.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="candidate-notes"
          className="text-xs uppercase tracking-wide text-muted-foreground"
        >
          Notes
        </label>
        <Textarea
          id="candidate-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={saveNotes}
          disabled={isPending}
          rows={3}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="candidate-tags"
          className="text-xs uppercase tracking-wide text-muted-foreground"
        >
          Tags
        </label>
        <Input
          id="candidate-tags"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          onBlur={saveTags}
          disabled={isPending}
          placeholder="Comma-separated, e.g. backend, remote"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
