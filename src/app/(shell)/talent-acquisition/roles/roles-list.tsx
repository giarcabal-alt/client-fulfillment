"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { NewRoleForm } from "./new-role-form";
import { RoleRow, type Role } from "./role-row";

export function RolesList({
  roles,
  clients,
}: {
  roles: Role[];
  clients: { id: string; company_name: string }[];
}) {
  const [addOpen, setAddOpen] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs tabular-nums text-muted-foreground">
          {roles.length} {roles.length === 1 ? "role" : "roles"}
        </p>
        <Button size="sm" onClick={() => setAddOpen(true)} className="shrink-0">
          + Add role
        </Button>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display text-lg text-ink-navy">
              Add a role
            </DialogTitle>
          </DialogHeader>
          <NewRoleForm clients={clients} onSuccess={() => setAddOpen(false)} />
        </DialogContent>
      </Dialog>

      {roles.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No roles yet — add one to get started.
        </p>
      ) : (
        <div className="w-full min-w-0 overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-3 py-2 font-normal">Title</th>
                <th className="px-2 py-2 font-normal">Client</th>
                <th className="px-2 py-2 font-normal">Status</th>
                <th className="px-2 py-2 font-normal">Classification</th>
                <th className="px-2 py-2 font-normal">Priority</th>
                <th className="px-2 py-2 font-normal">Target fill</th>
                <th className="px-2 py-2 text-right font-normal">Candidates</th>
                <th className="px-3 py-2 font-normal">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {roles.map((role) => (
                <RoleRow key={role.id} role={role} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
