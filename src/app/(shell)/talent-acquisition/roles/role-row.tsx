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
  updateRoleClassification,
  updateRoleJobDescription,
  updateRoleStatus,
  updateRoleTimezoneOverlap,
  updateRoleTitle,
} from "@/lib/talent-acquisition/roles-actions";
import {
  CLASSIFICATION_LABELS,
  NO_CLASSIFICATION_VALUE,
} from "@/lib/talent-acquisition/role-classifications";

type RoleClassification = "embedded_operator" | "project_based";

type Role = {
  id: string;
  title: string;
  job_description: string | null;
  status: "open" | "filled" | "closed";
  timezone_overlap: string | null;
  classification: RoleClassification | null;
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

// Sun Gold is a sparing accent only — DESIGN.md's Five Percent Rule bans it
// as a background or fill of any size (same rule the board's candidate
// status badge was fixed for), so "Project-Based" stays on the same
// ink-navy-family neutral treatment and gets its gold via a small accent
// dot instead of a full fill.
const CLASSIFICATION_STYLES: Record<RoleClassification, string> = {
  embedded_operator: "bg-ink-navy text-white",
  project_based: "bg-stone text-ink-navy",
};

const CLASSIFICATION_DOT: Partial<Record<RoleClassification, string>> = {
  project_based: "bg-sun-gold",
};

export function RoleRow({ role }: { role: Role }) {
  const [title, setTitle] = useState(role.title);
  const [jobDescription, setJobDescription] = useState(
    role.job_description ?? ""
  );
  const [status, setStatus] = useState<Role["status"]>(role.status);
  const [timezoneOverlap, setTimezoneOverlap] = useState(
    role.timezone_overlap ?? ""
  );
  const [classification, setClassification] = useState(
    role.classification ?? NO_CLASSIFICATION_VALUE
  );
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

  function saveTimezoneOverlap() {
    if (timezoneOverlap.trim() === (role.timezone_overlap ?? "")) return;
    setError(null);
    startTransition(async () => {
      const result = await updateRoleTimezoneOverlap(role.id, timezoneOverlap);
      if (result.error) {
        setError(result.error);
        setTimezoneOverlap(role.timezone_overlap ?? "");
      }
    });
  }

  function saveClassification(next: string | null) {
    if (!next || next === classification) return;
    const previous = classification;
    setClassification(next);
    setError(null);
    startTransition(async () => {
      const result = await updateRoleClassification(
        role.id,
        next === NO_CLASSIFICATION_VALUE ? null : next
      );
      if (result.error) {
        setError(result.error);
        setClassification(previous);
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
              <SelectTrigger size="sm" disabled={isPending} aria-label="Status">
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
            <Select value={classification} onValueChange={saveClassification}>
              <SelectTrigger size="sm" disabled={isPending} aria-label="Classification">
                <SelectValue>
                  {classification === NO_CLASSIFICATION_VALUE ? (
                    <span className="text-sm text-muted-foreground">
                      No classification
                    </span>
                  ) : (
                    <Badge
                      className={cn(
                        CLASSIFICATION_STYLES[
                          classification as RoleClassification
                        ]
                      )}
                    >
                      {CLASSIFICATION_DOT[
                        classification as RoleClassification
                      ] && (
                        <span
                          aria-hidden="true"
                          className={cn(
                            "size-1.5 shrink-0 rounded-full",
                            CLASSIFICATION_DOT[
                              classification as RoleClassification
                            ]
                          )}
                        />
                      )}
                      {
                        CLASSIFICATION_LABELS[
                          classification as RoleClassification
                        ]
                      }
                    </Badge>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_CLASSIFICATION_VALUE}>
                  No classification
                </SelectItem>
                <SelectItem value="embedded_operator">
                  Embedded Operator
                </SelectItem>
                <SelectItem value="project_based">Project-Based</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm tabular-nums text-muted-foreground">
              {role.candidateCount}{" "}
              {role.candidateCount === 1 ? "candidate" : "candidates"}
            </span>
          </div>
          <Input
            value={timezoneOverlap}
            onChange={(e) => setTimezoneOverlap(e.target.value)}
            onBlur={saveTimezoneOverlap}
            disabled={isPending}
            placeholder="Timezone overlap, e.g. 4hrs PHT/EST"
            aria-label="Timezone overlap"
            className="max-w-sm"
          />
          <Textarea
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            onBlur={saveJobDescription}
            disabled={isPending}
            placeholder="Job description…"
            aria-label="Job description"
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
