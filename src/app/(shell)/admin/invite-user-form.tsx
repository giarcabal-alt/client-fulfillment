"use client";

import { useActionState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { inviteUser, type AdminActionState } from "@/lib/admin-actions";

const initialState: AdminActionState = { error: null };

export function InviteUserForm() {
  const formRef = useRef<HTMLFormElement>(null);

  async function action(_prevState: AdminActionState, formData: FormData) {
    const result = await inviteUser(_prevState, formData);
    if (!result.error) {
      formRef.current?.reset();
    }
    return result;
  }

  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-wrap items-end gap-3"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <Label htmlFor="invite-email">Email</Label>
        <Input
          id="invite-email"
          name="email"
          type="email"
          placeholder="teammate@company.com"
          required
          className="max-w-sm"
        />
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Sending…" : "Send invite"}
      </Button>
      {state.error && (
        <p className="w-full text-sm text-destructive">{state.error}</p>
      )}
    </form>
  );
}
