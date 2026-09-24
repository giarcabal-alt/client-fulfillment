"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Section, SectionDivider } from "@/components/ui/section";
import { ClientRow, type ClientListItem } from "./client-row";
import { NewClientForm } from "./new-client-form";

export function ClientsList({ clients }: { clients: ClientListItem[] }) {
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
        <Section bodyClassName="px-0" className="gap-0 py-0">
          {clients.map((client, i) => (
            <div key={client.id}>
              {i > 0 && <SectionDivider />}
              <ClientRow client={client} />
            </div>
          ))}
        </Section>
      )}
    </>
  );
}
