"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import {
  updateCompanyName,
  updateDisplayName,
} from "@/lib/settings-actions";

export function CompanyNameField({
  companyName,
}: {
  companyName: string | null;
}) {
  const [value, setValue] = useState(companyName ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save() {
    if (value.trim() === (companyName ?? "")) return;
    setError(null);
    startTransition(async () => {
      const result = await updateCompanyName(value);
      if (result.error) {
        setError(result.error);
        setValue(companyName ?? "");
      }
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor="company-name"
        className="text-xs uppercase tracking-wide text-muted-foreground"
      >
        Company name
      </label>
      <Input
        id="company-name"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        disabled={isPending}
        placeholder="e.g. UpScaleSupport"
        className="max-w-sm"
      />
      <p className="text-xs text-muted-foreground">
        Shown to teammates across the org and used in outreach scripts.
      </p>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

export function DisplayNameField({
  displayName,
}: {
  displayName: string | null;
}) {
  const [value, setValue] = useState(displayName ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save() {
    if (value.trim() === (displayName ?? "")) return;
    setError(null);
    startTransition(async () => {
      const result = await updateDisplayName(value);
      if (result.error) {
        setError(result.error);
        setValue(displayName ?? "");
      }
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor="display-name"
        className="text-xs uppercase tracking-wide text-muted-foreground"
      >
        Your display name
      </label>
      <Input
        id="display-name"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        disabled={isPending}
        placeholder="e.g. Dani"
        className="max-w-sm"
      />
      <p className="text-xs text-muted-foreground">
        Signed as the recruiter in outreach scripts — only you can change
        this.
      </p>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
