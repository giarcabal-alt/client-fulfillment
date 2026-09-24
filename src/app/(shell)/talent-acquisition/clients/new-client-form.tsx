"use client";

import { useActionState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createClientRecord,
  type ClientActionState,
} from "@/lib/talent-acquisition/clients-actions";

const initialState: ClientActionState = { error: null };

export function NewClientForm({ onSuccess }: { onSuccess?: () => void }) {
  const formRef = useRef<HTMLFormElement>(null);

  async function action(_prevState: ClientActionState, formData: FormData) {
    const result = await createClientRecord(_prevState, formData);
    if (!result.error) {
      formRef.current?.reset();
      onSuccess?.();
    }
    return result;
  }

  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3 pt-1">
      <div className="flex flex-col gap-1">
        <Label htmlFor="new-client-company-name">Company name</Label>
        <Input id="new-client-company-name" name="company_name" required />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="new-client-industry">Industry</Label>
        <Input id="new-client-industry" name="industry" />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="new-client-website">Website</Label>
        <Input id="new-client-website" name="website" placeholder="e.g. acme.com" />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="new-client-location">Location</Label>
        <Input
          id="new-client-location"
          name="location"
          placeholder="e.g. Austin, TX, USA"
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="new-client-timezone">Timezone</Label>
        <Input
          id="new-client-timezone"
          name="timezone"
          placeholder="e.g. America/New_York"
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="new-client-poc-name">Point of contact</Label>
        <Input id="new-client-poc-name" name="point_of_contact_name" />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="new-client-poc-email">Contact email</Label>
        <Input
          id="new-client-poc-email"
          name="point_of_contact_email"
          type="email"
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="new-client-poc-phone">Contact phone</Label>
        <Input id="new-client-poc-phone" name="point_of_contact_phone" />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="new-client-notes">Notes</Label>
        <Textarea id="new-client-notes" name="notes" rows={3} />
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={isPending} className="self-start">
        {isPending ? "Adding…" : "Add client"}
      </Button>
    </form>
  );
}
