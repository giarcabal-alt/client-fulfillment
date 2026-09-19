"use client";

import { useActionState, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createCandidate,
  type CandidateActionState,
  type RoleMode,
} from "@/lib/talent-acquisition/candidates-actions";
import { SOURCE_PLATFORMS } from "@/lib/talent-acquisition/source-platforms";

const NEW_ROLE_VALUE = "__new__";
const NO_ROLE_VALUE = "none";
const NO_SOURCE_VALUE = "none";

const initialState: CandidateActionState = { error: null };

export function NewCandidateForm({
  roles,
  onSuccess,
}: {
  roles: { id: string; title: string }[];
  onSuccess: () => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [roleChoice, setRoleChoice] = useState<string>(NO_ROLE_VALUE);
  const [sourcePlatform, setSourcePlatform] = useState<string>(NO_SOURCE_VALUE);

  const roleMode: RoleMode =
    roleChoice === NO_ROLE_VALUE
      ? "none"
      : roleChoice === NEW_ROLE_VALUE
        ? "new"
        : "existing";

  function roleLabelFor(value: string) {
    if (value === NO_ROLE_VALUE) return "No role — Talent Pool";
    if (value === NEW_ROLE_VALUE) return "+ Create new role";
    return roles.find((role) => role.id === value)?.title ?? value;
  }

  async function action(prevState: CandidateActionState, formData: FormData) {
    const result = await createCandidate(prevState, formData);
    if (!result.error) {
      formRef.current?.reset();
      setRoleChoice(NO_ROLE_VALUE);
      setSourcePlatform(NO_SOURCE_VALUE);
      onSuccess();
    }
    return result;
  }

  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="new-candidate-name">Name</Label>
        <Input id="new-candidate-name" name="name" required />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="new-candidate-role">Role</Label>
        <Select value={roleChoice} onValueChange={(v) => v && setRoleChoice(v)}>
          <SelectTrigger id="new-candidate-role" className="w-full">
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
            <SelectItem value={NEW_ROLE_VALUE}>+ Create new role</SelectItem>
          </SelectContent>
        </Select>
        <input type="hidden" name="role_mode" value={roleMode} />
        {roleMode === "existing" && (
          <input type="hidden" name="role_id" value={roleChoice} />
        )}
      </div>

      {roleMode === "new" && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="new-candidate-new-role-title">New role title</Label>
          <Input
            id="new-candidate-new-role-title"
            name="new_role_title"
            placeholder="e.g. Senior Backend Engineer"
            required
          />
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="new-candidate-notes">Notes (optional)</Label>
        <Input
          id="new-candidate-notes"
          name="notes"
          placeholder="How you found them, context…"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="new-candidate-tags">Tags (optional)</Label>
        <Input
          id="new-candidate-tags"
          name="tags"
          placeholder="Comma-separated, e.g. backend, remote"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="new-candidate-source">Source (optional)</Label>
        <Select
          value={sourcePlatform}
          onValueChange={(v) => v && setSourcePlatform(v)}
        >
          <SelectTrigger id="new-candidate-source" className="w-full">
            <SelectValue>
              {(value: string) => (value === NO_SOURCE_VALUE ? "None" : value)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_SOURCE_VALUE}>None</SelectItem>
            {SOURCE_PLATFORMS.map((platform) => (
              <SelectItem key={platform} value={platform}>
                {platform}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <input
          type="hidden"
          name="source_platform"
          value={sourcePlatform === NO_SOURCE_VALUE ? "" : sourcePlatform}
        />
      </div>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={isPending} className="self-end">
        {isPending ? "Adding…" : "Add candidate"}
      </Button>
    </form>
  );
}
