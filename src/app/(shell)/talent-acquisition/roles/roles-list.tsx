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
import { NewRoleForm } from "./new-role-form";
import { RoleRow, type Role } from "./role-row";

export function RolesList({ roles }: { roles: Role[] }) {
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
          <NewRoleForm onSuccess={() => setAddOpen(false)} />
        </DialogContent>
      </Dialog>

      {roles.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No roles yet — add one to get started.
        </p>
      ) : (
        <Section bodyClassName="px-0" className="gap-0 py-0">
          {roles.map((role, i) => (
            <div key={role.id}>
              {i > 0 && <SectionDivider />}
              <RoleRow role={role} />
            </div>
          ))}
        </Section>
      )}
    </>
  );
}
