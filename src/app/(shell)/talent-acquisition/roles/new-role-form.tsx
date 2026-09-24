"use client";

import { useActionState, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createRole, type RoleActionState } from "@/lib/talent-acquisition/roles-actions";
import {
  CLASSIFICATION_LABELS,
  NO_CLASSIFICATION_VALUE,
} from "@/lib/talent-acquisition/role-classifications";
import {
  NEW_CLIENT_VALUE,
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
import { RoleSkillsEditor } from "./role-skills-editor";

const initialState: RoleActionState = { error: null };
const NO_VALUE = "none";

export function NewRoleForm({
  clients,
  onSuccess,
}: {
  clients: { id: string; company_name: string }[];
  onSuccess?: () => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [classification, setClassification] = useState(NO_CLASSIFICATION_VALUE);
  const [clientChoice, setClientChoice] = useState<string>(NO_CLIENT_VALUE);
  const [paymentTerms, setPaymentTerms] = useState<string>(NO_VALUE);
  const [seniorityLevel, setSeniorityLevel] = useState<string>(NO_VALUE);
  const [workArrangement, setWorkArrangement] = useState<string>(NO_VALUE);
  const [priority, setPriority] = useState<string>(NO_VALUE);
  const [jobDescription, setJobDescription] = useState("");

  const clientMode =
    clientChoice === NO_CLIENT_VALUE
      ? "none"
      : clientChoice === NEW_CLIENT_VALUE
        ? "new"
        : "existing";

  function clientLabelFor(value: string) {
    if (value === NO_CLIENT_VALUE) return "No client";
    if (value === NEW_CLIENT_VALUE) return "+ Create new client";
    return clients.find((c) => c.id === value)?.company_name ?? value;
  }

  function paymentTermsLabelFor(value: string) {
    if (value === NO_VALUE) return "None";
    return PAYMENT_TERMS_LABELS[value as keyof typeof PAYMENT_TERMS_LABELS] ?? value;
  }

  function seniorityLabelFor(value: string) {
    if (value === NO_VALUE) return "None";
    return SENIORITY_LEVEL_LABELS[value as keyof typeof SENIORITY_LEVEL_LABELS] ?? value;
  }

  function workArrangementLabelFor(value: string) {
    if (value === NO_VALUE) return "None";
    return WORK_ARRANGEMENT_LABELS[value as keyof typeof WORK_ARRANGEMENT_LABELS] ?? value;
  }

  function priorityLabelFor(value: string) {
    if (value === NO_VALUE) return "Standard";
    return ROLE_PRIORITY_LABELS[value as keyof typeof ROLE_PRIORITY_LABELS] ?? value;
  }

  async function action(_prevState: RoleActionState, formData: FormData) {
    const result = await createRole(_prevState, formData);
    if (!result.error) {
      formRef.current?.reset();
      setClassification(NO_CLASSIFICATION_VALUE);
      setClientChoice(NO_CLIENT_VALUE);
      setPaymentTerms(NO_VALUE);
      setSeniorityLevel(NO_VALUE);
      setWorkArrangement(NO_VALUE);
      setPriority(NO_VALUE);
      setJobDescription("");
      onSuccess?.();
    }
    return result;
  }

  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3 pt-1">
      <div className="flex flex-col gap-1">
        <Label htmlFor="new-role-title">Title</Label>
        <Input id="new-role-title" name="title" required />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="new-role-job-description">Job description</Label>
        <Textarea
          id="new-role-job-description"
          name="job_description"
          rows={3}
          value={jobDescription}
          onChange={(e) => setJobDescription(e.target.value)}
        />
      </div>

      <RoleSkillsEditor jobDescription={jobDescription} />

      <div className="flex flex-col gap-1">
        <Label htmlFor="new-role-client">Client</Label>
        <Select value={clientChoice} onValueChange={(v) => v && setClientChoice(v)}>
          <SelectTrigger id="new-role-client" className="w-full">
            <SelectValue>{(value: string) => clientLabelFor(value)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_CLIENT_VALUE}>No client</SelectItem>
            {clients.map((client) => (
              <SelectItem key={client.id} value={client.id}>
                {client.company_name}
              </SelectItem>
            ))}
            <SelectItem value={NEW_CLIENT_VALUE}>+ Create new client</SelectItem>
          </SelectContent>
        </Select>
        <input type="hidden" name="client_mode" value={clientMode} />
        {clientMode === "existing" && (
          <input type="hidden" name="client_id" value={clientChoice} />
        )}
      </div>

      {clientMode === "new" && (
        <div className="flex flex-col gap-1">
          <Label htmlFor="new-role-new-client-name">New client company name</Label>
          <Input
            id="new-role-new-client-name"
            name="new_client_name"
            placeholder="e.g. Acme Corp"
            required
          />
        </div>
      )}

      <div className="flex flex-col gap-1">
        <Label htmlFor="new-role-compensation">Compensation</Label>
        <Input
          id="new-role-compensation"
          name="compensation"
          placeholder="e.g. PHP 60,000/month"
        />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="new-role-payment-terms">Payment terms</Label>
        <Select value={paymentTerms} onValueChange={(v) => v && setPaymentTerms(v)}>
          <SelectTrigger id="new-role-payment-terms" className="w-full">
            <SelectValue>{(value: string) => paymentTermsLabelFor(value)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_VALUE}>None</SelectItem>
            {PAYMENT_TERMS.map((term) => (
              <SelectItem key={term} value={term}>
                {PAYMENT_TERMS_LABELS[term]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <input
          type="hidden"
          name="payment_terms"
          value={paymentTerms === NO_VALUE ? "" : paymentTerms}
        />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="new-role-seniority">Seniority level</Label>
        <Select value={seniorityLevel} onValueChange={(v) => v && setSeniorityLevel(v)}>
          <SelectTrigger id="new-role-seniority" className="w-full">
            <SelectValue>{(value: string) => seniorityLabelFor(value)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_VALUE}>None</SelectItem>
            {SENIORITY_LEVELS.map((level) => (
              <SelectItem key={level} value={level}>
                {SENIORITY_LEVEL_LABELS[level]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <input
          type="hidden"
          name="seniority_level"
          value={seniorityLevel === NO_VALUE ? "" : seniorityLevel}
        />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="new-role-work-arrangement">Work arrangement</Label>
        <Select value={workArrangement} onValueChange={(v) => v && setWorkArrangement(v)}>
          <SelectTrigger id="new-role-work-arrangement" className="w-full">
            <SelectValue>{(value: string) => workArrangementLabelFor(value)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_VALUE}>None</SelectItem>
            {WORK_ARRANGEMENTS.map((arrangement) => (
              <SelectItem key={arrangement} value={arrangement}>
                {WORK_ARRANGEMENT_LABELS[arrangement]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <input
          type="hidden"
          name="work_arrangement"
          value={workArrangement === NO_VALUE ? "" : workArrangement}
        />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="new-role-timezone-overlap">Timezone overlap</Label>
        <Input
          id="new-role-timezone-overlap"
          name="timezone_overlap"
          placeholder="e.g. 4hrs PHT/EST"
        />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="new-role-classification">Classification</Label>
        <Select value={classification} onValueChange={(v) => v && setClassification(v)}>
          <SelectTrigger id="new-role-classification" className="w-full">
            <SelectValue>
              {(value: string) =>
                value === NO_CLASSIFICATION_VALUE
                  ? "None"
                  : CLASSIFICATION_LABELS[value]
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_CLASSIFICATION_VALUE}>None</SelectItem>
            <SelectItem value="embedded_operator">Embedded Operator</SelectItem>
            <SelectItem value="project_based">Project-Based</SelectItem>
          </SelectContent>
        </Select>
        <input
          type="hidden"
          name="classification"
          value={classification === NO_CLASSIFICATION_VALUE ? "" : classification}
        />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="new-role-priority">Priority</Label>
        <Select value={priority} onValueChange={(v) => v && setPriority(v)}>
          <SelectTrigger id="new-role-priority" className="w-full">
            <SelectValue>{(value: string) => priorityLabelFor(value)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_VALUE}>Standard</SelectItem>
            {ROLE_PRIORITIES.filter((p) => p !== "standard").map((p) => (
              <SelectItem key={p} value={p}>
                {ROLE_PRIORITY_LABELS[p]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <input type="hidden" name="priority" value={priority === NO_VALUE ? "" : priority} />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="new-role-target-fill-date">Target fill date</Label>
        <Input id="new-role-target-fill-date" name="target_fill_date" type="date" />
      </div>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={isPending} className="self-start">
        {isPending ? "Adding…" : "Add role"}
      </Button>
    </form>
  );
}
