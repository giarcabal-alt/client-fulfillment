"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  deleteRole,
  updateRoleJobDescription,
  updateRoleStatus,
  updateRoleTitle,
} from "@/lib/talent-acquisition/roles-actions";

type Role = {
  id: string;
  title: string;
  job_description: string | null;
  status: "open" | "filled" | "closed";
  candidateCount: number;
};

const STATUS_STYLES: Record<Role["status"], string> = {
  open: "bg-work-blue text-white",
  filled: "bg-growth-green text-white",
  closed: "bg-stone text-slate-text",
};

const STATUS_LABELS: Record<Role["status"], string> = {
  open: "Open",
  filled: "Filled",
  closed: "Closed",
};

export function RoleRow({ role }: { role: Role }) {
  const [title, setTitle] = useState(role.title);
  const [jobDescription, setJobDescription] = useState(
    role.job_description ?? ""
  );
  const [status, setStatus] = useState<Role["status"]>(role.status);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function saveTitle() {
    if (title.trim() === role.title) return;
    setError(null);
    startTransition(async () => {
      const result = await updateRoleTitle(role.id, title);
      if (result.error) {
        setError(result.error);
        setTitle(role.title);
      }
    });
  }

  function saveJobDescription() {
    if (jobDescription.trim() === (role.job_description ?? "")) return;
    setError(null);
    startTransition(async () => {
      const result = await updateRoleJobDescription(role.id, jobDescription);
      if (result.error) {
        setError(result.error);
        setJobDescription(role.job_description ?? "");
      }
    });
  }

  function saveStatus(next: string | null) {
    if (!next) return;
    const previous = status;
    setStatus(next as Role["status"]);
    setError(null);
    startTransition(async () => {
      const result = await updateRoleStatus(role.id, next);
      if (result.error) {
        setError(result.error);
        setStatus(previous);
      }
    });
  }

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deleteRole(role.id);
      if (result.error) setError(result.error);
    });
  }

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={saveTitle}
              disabled={isPending}
              className="max-w-sm font-medium"
              aria-label="Role title"
            />
            <Select value={status} onValueChange={saveStatus}>
              <SelectTrigger size="sm" disabled={isPending}>
                <SelectValue>
                  <Badge className={cn(STATUS_STYLES[status])}>
                    {STATUS_LABELS[status]}
                  </Badge>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="filled">Filled</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm tabular-nums text-muted-foreground">
              {role.candidateCount}{" "}
              {role.candidateCount === 1 ? "candidate" : "candidates"}
            </span>
          </div>
          <Textarea
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            onBlur={saveJobDescription}
            disabled={isPending}
            placeholder="Job description…"
            rows={3}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={handleDelete}
        >
          Delete
        </Button>
      </div>
    </Card>
  );
}
