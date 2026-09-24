"use client";

// Self-contained state, same shape as RoleSkillsEditor.tsx — the Job
// Description tab lives inside the right-column Tabs (built in page.tsx),
// separate from RoleDetailForm's title/status/priority/properties state,
// since nothing else on the page needs to stay in sync with this field's
// live edits.

import { useState, useTransition } from "react";
import { Textarea } from "@/components/ui/textarea";
import { updateRoleJobDescription } from "@/lib/talent-acquisition/roles-actions";

export function JobDescriptionEditor({
  roleId,
  initialJobDescription,
}: {
  roleId: string;
  initialJobDescription: string;
}) {
  const [jobDescription, setJobDescription] = useState(initialJobDescription);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save() {
    if (jobDescription.trim() === initialJobDescription.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await updateRoleJobDescription(roleId, jobDescription);
      if (result.error) {
        setError(result.error);
        setJobDescription(initialJobDescription);
      }
    });
  }

  return (
    // Reading-width cap: DESIGN_SYSTEM.md §4 reserves the 1120px max width
    // for long-form reading text specifically — this is that text.
    <div className="flex max-w-[1120px] flex-col gap-1">
      <Textarea
        value={jobDescription}
        onChange={(e) => setJobDescription(e.target.value)}
        onBlur={save}
        disabled={isPending}
        placeholder="Job description…"
        aria-label="Job description"
        rows={16}
      />
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
