"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
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

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="truncate text-sm font-medium">{user.email}</p>
          <Input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            onBlur={saveDisplayName}
            disabled={isPending}
            placeholder="Display name"
            aria-label="Display name"
            className="max-w-xs"
          />
        </div>
        <Select value={role} onValueChange={saveRole}>
          <SelectTrigger size="sm" disabled={isPending} aria-label="Role">
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
      </div>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </Card>
  );
}
