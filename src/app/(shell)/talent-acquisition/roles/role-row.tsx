"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { propertyControlClass } from "@/components/ui/property-row";
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
  updateRolePriority,
  updateRoleStatus,
  updateRoleTimezoneOverlap,
  updateRoleTitle,
} from "@/lib/talent-acquisition/roles-actions";
import {
  CLASSIFICATION_LABELS,
  NO_CLASSIFICATION_VALUE,
} from "@/lib/talent-acquisition/role-classifications";
import { ROLE_PRIORITIES, ROLE_PRIORITY_LABELS } from "@/lib/talent-acquisition/role-fields";

type RoleClassification = "embedded_operator" | "project_based";
type RolePriority = "standard" | "urgent" | "on_hold";

export type Role = {
  id: string;
  title: string;
  job_description: string | null;
  status: "open" | "filled" | "closed";
  timezone_overlap: string | null;
  classification: RoleClassification | null;
  priority: RolePriority | null;
  target_fill_date: string | null;
  clientName: string | null;
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

const PRIORITY_STYLES: Record<RolePriority, string> = {
  urgent: "bg-destructive text-white",
  on_hold: "bg-stone text-slate-text",
  standard: "bg-stone text-slate-text",
};

const JD_PREVIEW_LENGTH = 90;

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
  const [priority, setPriority] = useState<RolePriority>(role.priority ?? "standard");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [jdOpen, setJdOpen] = useState(false);

  // Title is a `<textarea>`, not an `<input>` — an input can never wrap
  // text no matter what whitespace/word-break CSS is applied, and the
  // task explicitly requires long titles to wrap rather than truncate or
  // clip. Auto-grows to fit its content on every keystroke and on mount
  // (long existing titles need to be sized correctly right away).
  function autoResizeTitle(el: HTMLTextAreaElement | null) {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }

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

  function savePriority(next: string | null) {
    if (!next || next === priority) return;
    const previous = priority;
    setPriority(next as RolePriority);
    setError(null);
    startTransition(async () => {
      const result = await updateRolePriority(role.id, next === "standard" ? null : next);
      if (result.error) {
        setError(result.error);
        setPriority(previous);
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

  const jdPreview = jobDescription
    ? jobDescription.length > JD_PREVIEW_LENGTH
      ? `${jobDescription.slice(0, JD_PREVIEW_LENGTH).trimEnd()}…`
      : jobDescription
    : null;

  const targetFillLabel = role.target_fill_date
    ? new Date(`${role.target_fill_date}T00:00:00`).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";

  return (
    <>
      <tr className="border-b border-border align-top last:border-b-0 hover:bg-stone/20">
        <td className="px-3 py-2.5">
          <div className="flex flex-col gap-1">
            <textarea
              ref={autoResizeTitle}
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                autoResizeTitle(e.target);
              }}
              onBlur={saveTitle}
              disabled={isPending}
              aria-label="Role title"
              rows={1}
              className={cn(
                propertyControlClass,
                "w-full min-w-[16ch] resize-none overflow-hidden whitespace-normal break-words font-medium leading-snug"
              )}
            />
            {jobDescription && (
              <button
                type="button"
                onClick={() => setJdOpen((v) => !v)}
                className="w-fit rounded-sm text-left text-xs text-work-blue outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {jdOpen ? "Hide job description" : jdPreview}
              </button>
            )}
          </div>
        </td>
        <td className="px-2 py-2.5 text-sm text-muted-foreground">
          {role.clientName ?? "—"}
        </td>
        <td className="px-2 py-2.5">
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
        </td>
        <td className="px-2 py-2.5">
          <Select value={classification} onValueChange={saveClassification}>
            <SelectTrigger size="sm" disabled={isPending} aria-label="Classification">
              <SelectValue>
                {classification === NO_CLASSIFICATION_VALUE ? (
                  <span className="text-xs text-muted-foreground">None</span>
                ) : (
                  <Badge
                    className={cn(
                      CLASSIFICATION_STYLES[classification as RoleClassification]
                    )}
                  >
                    {CLASSIFICATION_DOT[classification as RoleClassification] && (
                      <span
                        aria-hidden="true"
                        className={cn(
                          "size-1.5 shrink-0 rounded-full",
                          CLASSIFICATION_DOT[classification as RoleClassification]
                        )}
                      />
                    )}
                    {CLASSIFICATION_LABELS[classification as RoleClassification]}
                  </Badge>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_CLASSIFICATION_VALUE}>None</SelectItem>
              <SelectItem value="embedded_operator">Embedded Operator</SelectItem>
              <SelectItem value="project_based">Project-Based</SelectItem>
            </SelectContent>
          </Select>
        </td>
        <td className="px-2 py-2.5">
          <Select value={priority} onValueChange={savePriority}>
            <SelectTrigger size="sm" disabled={isPending} aria-label="Priority">
              <SelectValue>
                <Badge className={cn(PRIORITY_STYLES[priority])}>
                  {ROLE_PRIORITY_LABELS[priority]}
                </Badge>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {ROLE_PRIORITIES.map((p) => (
                <SelectItem key={p} value={p}>
                  {ROLE_PRIORITY_LABELS[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </td>
        <td className="px-2 py-2.5 whitespace-nowrap text-sm tabular-nums text-muted-foreground">
          {targetFillLabel}
        </td>
        <td className="px-2 py-2.5 text-right text-sm tabular-nums text-muted-foreground">
          {role.candidateCount}
        </td>
        <td className="px-3 py-2.5">
          <div className="flex items-center justify-end gap-1.5">
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href={`/talent-acquisition/roles/${role.id}`}>Details</Link>}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isPending}
              onClick={handleDelete}
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              Delete
            </Button>
          </div>
        </td>
      </tr>
      {jdOpen && (
        <tr className="border-b border-border last:border-b-0">
          <td colSpan={8} className="bg-stone/10 px-4 py-3">
            <div className="flex flex-col gap-2">
              <Textarea
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                onBlur={saveJobDescription}
                disabled={isPending}
                placeholder="Job description…"
                aria-label="Job description"
                className="max-w-[1120px] text-sm"
                rows={4}
              />
              <input
                value={timezoneOverlap}
                onChange={(e) => setTimezoneOverlap(e.target.value)}
                onBlur={saveTimezoneOverlap}
                disabled={isPending}
                placeholder="Timezone overlap, e.g. 4hrs PHT/EST"
                aria-label="Timezone overlap"
                className={cn(propertyControlClass, "w-full max-w-xs")}
              />
            </div>
          </td>
        </tr>
      )}
      {error && (
        <tr>
          <td colSpan={8} className="px-4 py-1.5">
            <p className="text-sm text-destructive">{error}</p>
          </td>
        </tr>
      )}
    </>
  );
}
