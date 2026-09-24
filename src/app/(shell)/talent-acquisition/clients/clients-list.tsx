"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ClientRow, type ClientListItem } from "./client-row";
import { NewClientForm } from "./new-client-form";

export function ClientsList({
  clients,
  isAdmin,
}: {
  clients: ClientListItem[];
  isAdmin: boolean;
}) {
  const [addOpen, setAddOpen] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs tabular-nums text-muted-foreground">
          {clients.length} {clients.length === 1 ? "client" : "clients"}
        </p>
        <Button size="sm" onClick={() => setAddOpen(true)} className="shrink-0">
          + Add client
        </Button>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display text-lg text-ink-navy">
              Add a client
            </DialogTitle>
          </DialogHeader>
          <NewClientForm onSuccess={() => setAddOpen(false)} />
        </DialogContent>
      </Dialog>

      {clients.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No clients yet — add one to get started.
        </p>
      ) : (
        <div className="w-full min-w-0 overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[1100px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-3 py-2 font-normal">Company</th>
                <th className="px-3 py-2 font-normal">Website</th>
                <th className="px-3 py-2 font-normal">Location</th>
                <th className="px-3 py-2 font-normal">Timezone</th>
                <th className="px-3 py-2 font-normal">Point of contact</th>
                <th className="px-3 py-2 font-normal">Roles</th>
                <th className="px-3 py-2 font-normal">Notes</th>
                <th className="px-3 py-2 font-normal">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <ClientRow key={client.id} client={client} isAdmin={isAdmin} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
