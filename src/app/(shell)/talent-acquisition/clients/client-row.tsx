"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { deleteClientRecord } from "@/lib/talent-acquisition/clients-actions";
import { TimezoneClock } from "@/lib/talent-acquisition/timezone-clock";
import { ClientEditDialog } from "./client-edit-dialog";

export type ClientListItem = {
  id: string;
  company_name: string;
  industry: string | null;
  website: string | null;
  location: string | null;
  timezone: string | null;
  point_of_contact_name: string | null;
  point_of_contact_email: string | null;
  point_of_contact_phone: string | null;
  notes: string | null;
  roles: { id: string; title: string }[];
};

export function ClientRow({
  client,
  isAdmin,
}: {
  client: ClientListItem;
  isAdmin: boolean;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    setDeleteError(null);
    startTransition(async () => {
      const result = await deleteClientRecord(client.id);
      if (result.error) {
        setDeleteError(result.error);
      } else {
        setDeleteOpen(false);
      }
    });
  }

  return (
    <>
      <tr className="border-b border-border align-top last:border-b-0 hover:bg-stone/20">
        <td className="px-3 py-2.5">
          <div className="flex flex-col gap-0.5">
            <span className="font-medium text-ink-navy">{client.company_name}</span>
            {client.industry && (
              <span className="text-xs text-muted-foreground">{client.industry}</span>
            )}
          </div>
        </td>
        <td className="px-3 py-2.5">
          {client.website ? (
            <a
              href={
                client.website.startsWith("http")
                  ? client.website
                  : `https://${client.website}`
              }
              target="_blank"
              rel="noreferrer"
              className="text-work-blue hover:underline"
            >
              {client.website}
            </a>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </td>
        <td className="px-3 py-2.5 text-sm text-muted-foreground">
          {client.location ?? "—"}
        </td>
        <td className="px-3 py-2.5">
          <TimezoneClock timezone={client.timezone} clientLabel={client.company_name} />
        </td>
        <td className="px-3 py-2.5">
          <div className="flex flex-col gap-0.5 text-sm">
            <span className="text-ink-navy">
              {client.point_of_contact_name ?? (
                <span className="text-muted-foreground">—</span>
              )}
            </span>
            {client.point_of_contact_email && (
              <a
                href={`mailto:${client.point_of_contact_email}`}
                className="text-xs text-work-blue hover:underline"
              >
                {client.point_of_contact_email}
              </a>
            )}
            {client.point_of_contact_phone && (
              <span className="text-xs text-muted-foreground">
                {client.point_of_contact_phone}
              </span>
            )}
          </div>
        </td>
        <td className="px-3 py-2.5">
          {client.roles.length === 0 ? (
            <span className="text-sm text-muted-foreground">—</span>
          ) : (
            <div className="flex flex-col gap-0.5">
              {client.roles.map((role) => (
                <Link
                  key={role.id}
                  href={`/talent-acquisition/roles/${role.id}`}
                  className="text-sm text-work-blue hover:underline"
                >
                  {role.title}
                </Link>
              ))}
            </div>
          )}
        </td>
        <td className="max-w-[220px] px-3 py-2.5 text-sm whitespace-normal break-words text-muted-foreground">
          {client.notes ?? "—"}
        </td>
        <td className="px-3 py-2.5">
          <div className="flex items-center justify-end gap-1.5">
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              Edit
            </Button>
            {isAdmin && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDeleteError(null);
                  setDeleteOpen(true);
                }}
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                Delete
              </Button>
            )}
          </div>
        </td>
      </tr>

      <ClientEditDialog client={client} open={editOpen} onOpenChange={setEditOpen} />

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display text-lg text-ink-navy">
              Delete {client.company_name}?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This permanently removes the client record. This can&apos;t be undone.
          </p>
          {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleDelete}
              disabled={isPending}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
