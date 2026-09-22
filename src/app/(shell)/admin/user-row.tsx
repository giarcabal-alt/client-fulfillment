"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { propertyControlClass } from "@/components/ui/property-row";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  deleteUser,
  resetUserPassword,
  updateUserDisplayName,
  updateUserRole,
} from "@/lib/admin-actions";

type Role = "admin" | "member";

type AdminUser = {
  id: string;
  email: string;
  displayName: string | null;
  role: Role;
};

const ROLE_STYLES: Record<Role, string> = {
  admin: "bg-work-blue text-white",
  member: "bg-stone text-slate-text",
};

const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  member: "Member",
};

export function UserRow({ user }: { user: AdminUser }) {
  const [displayName, setDisplayName] = useState(user.displayName ?? "");
  const [role, setRole] = useState<Role>(user.role);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  // Shared by both controls' aria-describedby — a role-change guard
  // failure (self-demotion, last-admin) and a display-name save failure
  // both land in the same error state and render in the same place.
  const errorId = `user-row-error-${user.id}`;

  function saveDisplayName() {
    if (displayName.trim() === (user.displayName ?? "")) return;
    setError(null);
    startTransition(async () => {
      const result = await updateUserDisplayName(user.id, displayName);
      if (result.error) {
        setError(result.error);
        setDisplayName(user.displayName ?? "");
      }
    });
  }

  function saveRole(next: string | null) {
    if (!next || next === role) return;
    const previous = role;
    setRole(next as Role);
    setError(null);
    startTransition(async () => {
      const result = await updateUserRole(user.id, next);
      if (result.error) {
        setError(result.error);
        setRole(previous);
      }
    });
  }

  const [resetOpen, setResetOpen] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);
  const [resetPending, startResetTransition] = useTransition();

  function sendReset() {
    setResetError(null);
    startResetTransition(async () => {
      const result = await resetUserPassword(user.email);
      if (result.error) {
        setResetError(result.error);
        return;
      }
      setResetOpen(false);
      setResetSent(true);
    });
  }

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletePending, startDeleteTransition] = useTransition();

  function confirmDelete() {
    setDeleteError(null);
    startDeleteTransition(async () => {
      const result = await deleteUser(user.id);
      if (result.error) {
        setDeleteError(result.error);
        return;
      }
      setDeleteOpen(false);
      // No local "deleted" state to set — revalidatePath("/admin") inside
      // deleteUser refreshes the server-rendered user list, which
      // unmounts this row once it no longer appears in that list.
    });
  }

  return (
    <div className="px-4 py-2.5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 basis-full sm:basis-auto sm:flex-1">
          <p className="truncate text-sm font-medium">{user.email}</p>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            onBlur={saveDisplayName}
            disabled={isPending}
            placeholder="Display name"
            aria-label="Display name"
            aria-describedby={error ? errorId : undefined}
            className={cn(propertyControlClass, "w-auto max-w-xs -ml-1.5")}
          />
        </div>
        <Select value={role} onValueChange={saveRole}>
          <SelectTrigger
            size="sm"
            disabled={isPending}
            aria-label="Role"
            aria-describedby={error ? errorId : undefined}
          >
            <SelectValue>
              <Badge className={cn(ROLE_STYLES[role])}>
                {ROLE_LABELS[role]}
              </Badge>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="member">Member</SelectItem>
          </SelectContent>
        </Select>

        <Dialog open={resetOpen} onOpenChange={setResetOpen}>
          <DialogTrigger render={<Button variant="outline" size="sm" />}>
            Reset password
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Send password reset?</DialogTitle>
              <DialogDescription>
                {user.email} will get an email with a link to set a new
                password.
              </DialogDescription>
            </DialogHeader>
            {resetError && (
              <p role="alert" className="text-sm text-destructive">
                {resetError}
              </p>
            )}
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>
                Cancel
              </DialogClose>
              <Button onClick={sendReset} disabled={resetPending}>
                {resetPending ? "Sending…" : "Send email"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogTrigger render={<Button variant="outline" size="sm" />}>
            Delete
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete {user.email}?</DialogTitle>
              <DialogDescription>
                This permanently removes their account and sign-in access.
                This can&apos;t be undone.
              </DialogDescription>
            </DialogHeader>
            {deleteError && (
              <p role="alert" className="text-sm text-destructive">
                {deleteError}
              </p>
            )}
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>
                Cancel
              </DialogClose>
              <Button
                variant="destructive"
                onClick={confirmDelete}
                disabled={deletePending}
              >
                {deletePending ? "Deleting…" : "Delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      {error && (
        <p id={errorId} role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      )}
      {resetSent && (
        <p aria-hidden="true" className="mt-2 text-xs font-medium text-growth-green">
          Reset email sent
        </p>
      )}
      <span role="status" aria-live="polite" className="sr-only">
        {resetSent ? "Reset email sent" : ""}
      </span>
    </div>
  );
}
