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
import { Textarea } from "@/components/ui/textarea";
import { createRole, type RoleActionState } from "@/lib/talent-acquisition/roles-actions";
import {
  CLASSIFICATION_LABELS,
  NO_CLASSIFICATION_VALUE,
} from "@/lib/talent-acquisition/role-classifications";

const initialState: RoleActionState = { error: null };

export function NewRoleForm({ onSuccess }: { onSuccess?: () => void }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [classification, setClassification] = useState(NO_CLASSIFICATION_VALUE);

  async function action(_prevState: RoleActionState, formData: FormData) {
    const result = await createRole(_prevState, formData);
    if (!result.error) {
      formRef.current?.reset();
      setClassification(NO_CLASSIFICATION_VALUE);
      onSuccess?.();
    }
    return result;
  }

  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3 pt-1">
      <div className="flex flex-col gap-1">
        <Label htmlFor="new-role-title">Title</Label>
        <Input id="new-role-title" name="title" required />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="new-role-job-description">Job description</Label>
        <Textarea id="new-role-job-description" name="job_description" rows={3} />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="new-role-timezone-overlap">Timezone overlap</Label>
        <Input
          id="new-role-timezone-overlap"
          name="timezone_overlap"
          placeholder="e.g. 4hrs PHT/EST"
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="new-role-classification">Classification</Label>
        <Select value={classification} onValueChange={(v) => v && setClassification(v)}>
          <SelectTrigger id="new-role-classification" className="w-full">
            <SelectValue>
              {(value: string) =>
                value === NO_CLASSIFICATION_VALUE
                  ? "None"
                  : CLASSIFICATION_LABELS[value]
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_CLASSIFICATION_VALUE}>None</SelectItem>
            <SelectItem value="embedded_operator">Embedded Operator</SelectItem>
            <SelectItem value="project_based">Project-Based</SelectItem>
          </SelectContent>
        </Select>
        <input
          type="hidden"
          name="classification"
          value={classification === NO_CLASSIFICATION_VALUE ? "" : classification}
        />
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={isPending} className="self-start">
        {isPending ? "Adding…" : "Add role"}
      </Button>
    </form>
  );
}
