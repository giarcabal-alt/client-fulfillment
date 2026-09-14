"use client";

import { useActionState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createRole, type RoleActionState } from "@/lib/talent-acquisition/roles-actions";

const initialState: RoleActionState = { error: null };

export function NewRoleForm() {
  const formRef = useRef<HTMLFormElement>(null);

  async function action(_prevState: RoleActionState, formData: FormData) {
    const result = await createRole(_prevState, formData);
    if (!result.error) {
      formRef.current?.reset();
    }
    return result;
  }

  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="new-role-title">Title</Label>
        <Input id="new-role-title" name="title" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="new-role-job-description">Job description</Label>
        <Textarea id="new-role-job-description" name="job_description" rows={3} />
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={isPending} className="self-start">
        {isPending ? "Adding…" : "Add role"}
      </Button>
    </form>
  );
}
