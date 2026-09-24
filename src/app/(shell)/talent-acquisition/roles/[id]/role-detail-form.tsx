"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  PropertyRow,
  propertyControlClass,
  propertySelectTriggerClass,
} from "@/components/ui/property-row";
import { Section } from "@/components/ui/section";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TimezoneClock } from "@/lib/talent-acquisition/timezone-clock";
import { cn } from "@/lib/utils";
import {
  updateRoleClassification,
  updateRoleClientId,
  updateRoleCompensation,
  updateRolePaymentTerms,
  updateRolePriority,
  updateRoleSeniorityLevel,
  updateRoleStatus,
  updateRoleTargetFillDate,
  updateRoleTimezoneOverlap,
  updateRoleTitle,
  updateRoleWorkArrangement,
} from "@/lib/talent-acquisition/roles-actions";
import {
  CLASSIFICATION_LABELS,
  NO_CLASSIFICATION_VALUE,
} from "@/lib/talent-acquisition/role-classifications";
import {
  NO_CLIENT_VALUE,
  PAYMENT_TERMS,
  PAYMENT_TERMS_LABELS,
  ROLE_PRIORITIES,
  ROLE_PRIORITY_LABELS,
  SENIORITY_LEVELS,
  SENIORITY_LEVEL_LABELS,
  WORK_ARRANGEMENTS,
  WORK_ARRANGEMENT_LABELS,
} from "@/lib/talent-acquisition/role-fields";

const ROLE_STATUSES = ["open", "filled", "closed"] as const;
const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  filled: "Filled",
  closed: "Closed",
};
const STATUS_STYLES: Record<string, string> = {
  open: "bg-work-blue text-white",
  filled: "bg-growth-green text-white",
  closed: "bg-stone text-slate-text",
};

const PRIORITY_STYLES: Record<string, string> = {
  urgent: "bg-destructive text-white",
  on_hold: "bg-stone text-slate-text",
  standard: "bg-stone text-slate-text",
};

export type RoleDetail = {
  id: string;
  title: string;
  job_description: string | null;
  status: "open" | "filled" | "closed";
  client_id: string | null;
  compensation: string | null;
  payment_terms: string | null;
  seniority_level: string | null;
  work_arrangement: string | null;
  timezone_overlap: string | null;
  classification: string | null;
  priority: string | null;
  target_fill_date: string | null;
};

// Header (title/status/priority + a read-only client link+clock) and the
// left-column Properties list are one component, not two, so title/
// status/priority/client state stays in a single source of truth — a
// separate header component with its own copy of `priority` state would
// drift from the left column's own editable Priority row until a full
// page reload. `children` is the right-column tabbed panel (Skills/Job
// Description/Candidates/History), built server-side in page.tsx and
// passed through — same "server-built children into a client wrapper"
// shape candidate-detail's page.tsx already uses for its own Tabs.
export function RoleDetailForm({
  role,
  clients,
  children,
}: {
  role: RoleDetail;
  clients: { id: string; company_name: string; timezone: string | null }[];
  children: React.ReactNode;
}) {
  const [title, setTitle] = useState(role.title);
  const [status, setStatus] = useState(role.status);
  const [clientId, setClientId] = useState(role.client_id ?? NO_CLIENT_VALUE);
  const [compensation, setCompensation] = useState(role.compensation ?? "");
  const [paymentTerms, setPaymentTerms] = useState(role.payment_terms ?? NO_CLIENT_VALUE);
  const [seniorityLevel, setSeniorityLevel] = useState(
    role.seniority_level ?? NO_CLIENT_VALUE
  );
  const [workArrangement, setWorkArrangement] = useState(
    role.work_arrangement ?? NO_CLIENT_VALUE
  );
  const [timezoneOverlap, setTimezoneOverlap] = useState(role.timezone_overlap ?? "");
  const [classification, setClassification] = useState(
    role.classification ?? NO_CLASSIFICATION_VALUE
  );
  const [priority, setPriority] = useState(role.priority ?? "standard");
  const [targetFillDate, setTargetFillDate] = useState(role.target_fill_date ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedClient = clients.find((c) => c.id === clientId) ?? null;

  function clientLabelFor(value: string) {
    if (value === NO_CLIENT_VALUE) return "No client";
    return clients.find((c) => c.id === value)?.company_name ?? value;
  }

  function paymentTermsLabelFor(value: string) {
    if (value === NO_CLIENT_VALUE) return "None";
    return PAYMENT_TERMS_LABELS[value as keyof typeof PAYMENT_TERMS_LABELS] ?? value;
  }

  function seniorityLabelFor(value: string) {
    if (value === NO_CLIENT_VALUE) return "None";
    return SENIORITY_LEVEL_LABELS[value as keyof typeof SENIORITY_LEVEL_LABELS] ?? value;
  }

  function workArrangementLabelFor(value: string) {
    if (value === NO_CLIENT_VALUE) return "None";
    return WORK_ARRANGEMENT_LABELS[value as keyof typeof WORK_ARRANGEMENT_LABELS] ?? value;
  }

  function priorityLabelFor(value: string) {
    return ROLE_PRIORITY_LABELS[value as keyof typeof ROLE_PRIORITY_LABELS] ?? value;
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

  function handleStatusChange(next: string | null) {
    if (!next || next === status) return;
    const previous = status;
    setStatus(next as RoleDetail["status"]);
    setError(null);
    startTransition(async () => {
      const result = await updateRoleStatus(role.id, next);
      if (result.error) {
        setError(result.error);
        setStatus(previous);
      }
    });
  }

  function handleClientChange(next: string | null) {
    if (!next || next === clientId) return;
    const previous = clientId;
    setClientId(next);
    setError(null);
    startTransition(async () => {
      const result = await updateRoleClientId(
        role.id,
        next === NO_CLIENT_VALUE ? null : next
      );
      if (result.error) {
        setError(result.error);
        setClientId(previous);
      }
    });
  }

  function saveCompensation() {
    if (compensation.trim() === (role.compensation ?? "")) return;
    setError(null);
    startTransition(async () => {
      const result = await updateRoleCompensation(role.id, compensation);
      if (result.error) setError(result.error);
    });
  }

  function handlePaymentTermsChange(next: string | null) {
    if (!next || next === paymentTerms) return;
    const previous = paymentTerms;
    setPaymentTerms(next);
    setError(null);
    startTransition(async () => {
      const result = await updateRolePaymentTerms(
        role.id,
        next === NO_CLIENT_VALUE ? null : next
      );
      if (result.error) {
        setError(result.error);
        setPaymentTerms(previous);
      }
    });
  }

  function handleSeniorityChange(next: string | null) {
    if (!next || next === seniorityLevel) return;
    const previous = seniorityLevel;
    setSeniorityLevel(next);
    setError(null);
    startTransition(async () => {
      const result = await updateRoleSeniorityLevel(
        role.id,
        next === NO_CLIENT_VALUE ? null : next
      );
      if (result.error) {
        setError(result.error);
        setSeniorityLevel(previous);
      }
    });
  }

  function handleWorkArrangementChange(next: string | null) {
    if (!next || next === workArrangement) return;
    const previous = workArrangement;
    setWorkArrangement(next);
    setError(null);
    startTransition(async () => {
      const result = await updateRoleWorkArrangement(
        role.id,
        next === NO_CLIENT_VALUE ? null : next
      );
      if (result.error) {
        setError(result.error);
        setWorkArrangement(previous);
      }
    });
  }

  function saveTimezoneOverlap() {
    if (timezoneOverlap.trim() === (role.timezone_overlap ?? "")) return;
    setError(null);
    startTransition(async () => {
      const result = await updateRoleTimezoneOverlap(role.id, timezoneOverlap);
      if (result.error) setError(result.error);
    });
  }

  function handleClassificationChange(next: string | null) {
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

  function handlePriorityChange(next: string | null) {
    if (!next || next === priority) return;
    const previous = priority;
    setPriority(next);
    setError(null);
    startTransition(async () => {
      const result = await updateRolePriority(
        role.id,
        next === "standard" ? null : next
      );
      if (result.error) {
        setError(result.error);
        setPriority(previous);
      }
    });
  }

  function saveTargetFillDate() {
    if (targetFillDate === (role.target_fill_date ?? "")) return;
    setError(null);
    startTransition(async () => {
      const result = await updateRoleTargetFillDate(role.id, targetFillDate || null);
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={saveTitle}
            disabled={isPending}
            aria-label="Role title"
            className="min-w-[10ch] basis-full flex-1 rounded-md border border-transparent bg-transparent px-1.5 py-1 font-display text-xl text-ink-navy outline-none hover:border-border focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:basis-auto"
          />
          <Select value={status} onValueChange={handleStatusChange} disabled={isPending}>
            <SelectTrigger
              aria-label="Status"
              size="sm"
              className="h-auto w-fit border-none bg-transparent p-0 shadow-none hover:bg-transparent"
            >
              <SelectValue>
                {(value: string) => (
                  <Badge className={cn(STATUS_STYLES[value])}>
                    {STATUS_LABELS[value] ?? value}
                  </Badge>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {ROLE_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={priority} onValueChange={handlePriorityChange} disabled={isPending}>
            <SelectTrigger
              aria-label="Priority"
              size="sm"
              className="h-auto w-fit border-none bg-transparent p-0 shadow-none hover:bg-transparent"
            >
              <SelectValue>
                {(value: string) => (
                  <Badge className={cn(PRIORITY_STYLES[value])}>
                    {priorityLabelFor(value)}
                  </Badge>
                )}
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
        </div>

        {selectedClient && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-1.5">
            <Link
              href="/talent-acquisition/clients"
              className="text-sm font-medium text-work-blue hover:underline"
            >
              {selectedClient.company_name}
            </Link>
            <TimezoneClock
              timezone={selectedClient.timezone}
              clientLabel={selectedClient.company_name}
            />
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:items-start">
        <Section title="Properties">
          <div className="flex flex-col">
            <PropertyRow label="Client">
              <Select value={clientId} onValueChange={handleClientChange} disabled={isPending}>
                <SelectTrigger aria-label="Client" className={propertySelectTriggerClass}>
                  <SelectValue>{(value: string) => clientLabelFor(value)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_CLIENT_VALUE}>No client</SelectItem>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.company_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </PropertyRow>

            <PropertyRow label="Compensation">
              <Input
                aria-label="Compensation"
                value={compensation}
                onChange={(e) => setCompensation(e.target.value)}
                onBlur={saveCompensation}
                disabled={isPending}
                placeholder="e.g. PHP 60,000/month"
                className={cn(propertyControlClass, "whitespace-normal break-words")}
              />
            </PropertyRow>

            <PropertyRow label="Payment terms">
              <Select
                value={paymentTerms}
                onValueChange={handlePaymentTermsChange}
                disabled={isPending}
              >
                <SelectTrigger aria-label="Payment terms" className={propertySelectTriggerClass}>
                  <SelectValue>{(value: string) => paymentTermsLabelFor(value)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_CLIENT_VALUE}>None</SelectItem>
                  {PAYMENT_TERMS.map((term) => (
                    <SelectItem key={term} value={term}>
                      {PAYMENT_TERMS_LABELS[term]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </PropertyRow>

            <PropertyRow label="Seniority level">
              <Select
                value={seniorityLevel}
                onValueChange={handleSeniorityChange}
                disabled={isPending}
              >
                <SelectTrigger aria-label="Seniority level" className={propertySelectTriggerClass}>
                  <SelectValue>{(value: string) => seniorityLabelFor(value)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_CLIENT_VALUE}>None</SelectItem>
                  {SENIORITY_LEVELS.map((level) => (
                    <SelectItem key={level} value={level}>
                      {SENIORITY_LEVEL_LABELS[level]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </PropertyRow>

            <PropertyRow label="Work arrangement">
              <Select
                value={workArrangement}
                onValueChange={handleWorkArrangementChange}
                disabled={isPending}
              >
                <SelectTrigger
                  aria-label="Work arrangement"
                  className={propertySelectTriggerClass}
                >
                  <SelectValue>{(value: string) => workArrangementLabelFor(value)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_CLIENT_VALUE}>None</SelectItem>
                  {WORK_ARRANGEMENTS.map((arrangement) => (
                    <SelectItem key={arrangement} value={arrangement}>
                      {WORK_ARRANGEMENT_LABELS[arrangement]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </PropertyRow>

            <PropertyRow label="Timezone overlap">
              <Input
                aria-label="Timezone overlap"
                value={timezoneOverlap}
                onChange={(e) => setTimezoneOverlap(e.target.value)}
                onBlur={saveTimezoneOverlap}
                disabled={isPending}
                placeholder="e.g. 4hrs PHT/EST"
                className={cn(propertyControlClass, "whitespace-normal break-words")}
              />
            </PropertyRow>

            <PropertyRow label="Classification">
              <Select
                value={classification}
                onValueChange={handleClassificationChange}
                disabled={isPending}
              >
                <SelectTrigger aria-label="Classification" className={propertySelectTriggerClass}>
                  <SelectValue>
                    {(value: string) =>
                      value === NO_CLASSIFICATION_VALUE ? "None" : CLASSIFICATION_LABELS[value]
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_CLASSIFICATION_VALUE}>None</SelectItem>
                  <SelectItem value="embedded_operator">Embedded Operator</SelectItem>
                  <SelectItem value="project_based">Project-Based</SelectItem>
                </SelectContent>
              </Select>
            </PropertyRow>

            <PropertyRow label="Priority">
              <Select value={priority} onValueChange={handlePriorityChange} disabled={isPending}>
                <SelectTrigger aria-label="Priority" className={propertySelectTriggerClass}>
                  <SelectValue>{(value: string) => priorityLabelFor(value)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {ROLE_PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {ROLE_PRIORITY_LABELS[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </PropertyRow>

            <PropertyRow label="Target fill date">
              <Input
                aria-label="Target fill date"
                type="date"
                value={targetFillDate}
                onChange={(e) => setTargetFillDate(e.target.value)}
                onBlur={saveTargetFillDate}
                disabled={isPending}
                className={propertyControlClass}
              />
            </PropertyRow>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </Section>

        <Section bodyClassName="px-3">{children}</Section>
      </div>
    </div>
  );
}
