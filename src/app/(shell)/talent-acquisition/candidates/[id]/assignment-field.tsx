"use client";

import { useState, useTransition } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateCandidateAssignment } from "@/lib/talent-acquisition/candidates-actions";

const UNASSIGNED_VALUE = "unassigned";

type Profile = { id: string; displayName: string | null };

export function AssignmentField({
  candidateId,
  assignee,
  isAdmin,
  assignableProfiles,
}: {
  candidateId: string;
  assignee: Profile | null;
  isAdmin: boolean;
  assignableProfiles: Profile[];
}) {
  const [assignedId, setAssignedId] = useState(assignee?.id ?? UNASSIGNED_VALUE);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Read-only for everyone except admins — the control to change this is
  // admin-only (checked server-side too, in updateCandidateAssignment via
  // requireAdminUser(); this UI gate is convenience, not the boundary).
  if (!isAdmin) {
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          Assigned to
        </span>
        <p className="text-sm">
          {assignee ? assignee.displayName ?? "Unnamed teammate" : "Unassigned"}
        </p>
      </div>
    );
  }

  function labelFor(value: string) {
    if (value === UNASSIGNED_VALUE) return "Unassigned";
    const profile = assignableProfiles.find((p) => p.id === value);
    return profile?.displayName ?? "Unnamed teammate";
  }

  function save(next: string | null) {
    if (!next || next === assignedId) return;
    const previous = assignedId;
    setAssignedId(next);
    setError(null);
    startTransition(async () => {
      const result = await updateCandidateAssignment(
        candidateId,
        next === UNASSIGNED_VALUE ? null : next
      );
      if (result.error) {
        setError(result.error);
        setAssignedId(previous);
      }
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">
        Assigned to
      </span>
      <Select value={assignedId} onValueChange={save} disabled={isPending}>
        <SelectTrigger className="max-w-sm" aria-label="Assigned to">
          <SelectValue>{(value: string) => labelFor(value)}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={UNASSIGNED_VALUE}>Unassigned</SelectItem>
          {assignableProfiles.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.displayName ?? "Unnamed teammate"}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
