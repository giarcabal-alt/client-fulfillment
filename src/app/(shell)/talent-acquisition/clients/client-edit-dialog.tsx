"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  updateClientRecord,
  type ClientActionState,
} from "@/lib/talent-acquisition/clients-actions";
import {
  NO_TIMEZONE_VALUE,
  timezoneSelectValue,
} from "@/lib/talent-acquisition/client-timezones";
import { TimezoneSelect } from "./timezone-select";
import type { ClientListItem } from "./client-row";

const initialState: ClientActionState = { error: null };

// One "Save" dialog for every field at once, rather than the old
// per-field save-on-blur detail page — with 8+ fields moving into a
// full-width table row, a dialog keeps editing in one clear, explicit
// step instead of a table cell turning into a live input on click.
export function ClientEditDialog({
  client,
  open,
  onOpenChange,
}: {
  client: ClientListItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [timezone, setTimezone] = useState(timezoneSelectValue(client.timezone));

  async function action(_prevState: ClientActionState, formData: FormData) {
    const result = await updateClientRecord(client.id, _prevState, formData);
    if (!result.error) {
      onOpenChange(false);
    }
    return result;
  }

  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display text-lg text-ink-navy">
            Edit {client.company_name}
          </DialogTitle>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-3 pt-1">
          <div className="flex flex-col gap-1">
            <Label htmlFor="edit-client-company-name">Company name</Label>
            <Input
              id="edit-client-company-name"
              name="company_name"
              defaultValue={client.company_name}
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="edit-client-industry">Industry</Label>
            <Input
              id="edit-client-industry"
              name="industry"
              defaultValue={client.industry ?? ""}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="edit-client-website">Website</Label>
            <Input
              id="edit-client-website"
              name="website"
              placeholder="e.g. acme.com"
              defaultValue={client.website ?? ""}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="edit-client-location">Location</Label>
            <Input
              id="edit-client-location"
              name="location"
              placeholder="e.g. Austin, TX, USA"
              defaultValue={client.location ?? ""}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="edit-client-timezone">Timezone</Label>
            <TimezoneSelect
              triggerId="edit-client-timezone"
              value={timezone}
              onValueChange={(next) => next && setTimezone(next)}
            />
            <input
              type="hidden"
              name="timezone"
              value={timezone === NO_TIMEZONE_VALUE ? "" : timezone}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="edit-client-poc-name">Point of contact</Label>
            <Input
              id="edit-client-poc-name"
              name="point_of_contact_name"
              defaultValue={client.point_of_contact_name ?? ""}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="edit-client-poc-email">Contact email</Label>
            <Input
              id="edit-client-poc-email"
              name="point_of_contact_email"
              type="email"
              defaultValue={client.point_of_contact_email ?? ""}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="edit-client-poc-phone">Contact phone</Label>
            <Input
              id="edit-client-poc-phone"
              name="point_of_contact_phone"
              defaultValue={client.point_of_contact_phone ?? ""}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="edit-client-notes">Notes</Label>
            <Textarea
              id="edit-client-notes"
              name="notes"
              rows={3}
              defaultValue={client.notes ?? ""}
            />
          </div>
          {state.error && <p className="text-sm text-destructive">{state.error}</p>}
          <div className="flex items-center gap-2 self-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
