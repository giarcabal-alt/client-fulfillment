"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import {
  updateCompanyName,
  updateDisplayName,
} from "@/lib/settings-actions";

// Save-on-blur has no submit button to give feedback around, so a
// successful save was previously silent — indistinguishable from "still
// saving" for every user, not just screen-reader ones. The visible
// confirmation is conditionally rendered (like the existing error message)
// so it doesn't reserve permanent layout space; the sr-only status region
// stays mounted at all times so assistive tech reliably picks up the text
// change per WCAG 4.1.3 Status Messages, which a freshly-mounted live
// region can miss.
const SAVED_MESSAGE_DURATION_MS = 2000;

export function CompanyNameField({
  companyName,
}: {
  companyName: string | null;
}) {
  const [value, setValue] = useState(companyName ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();
  const savedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
    };
  }, []);

  function save() {
    if (value.trim() === (companyName ?? "")) return;
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updateCompanyName(value);
      if (result.error) {
        setError(result.error);
        setValue(companyName ?? "");
        return;
      }
      setSaved(true);
      if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
      savedTimeoutRef.current = setTimeout(
        () => setSaved(false),
        SAVED_MESSAGE_DURATION_MS
      );
    });
  }

  return (
    <div className="flex flex-col gap-1">
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
        aria-describedby={
          error
            ? "company-name-help company-name-error"
            : "company-name-help"
        }
        aria-invalid={!!error}
      />
      <p id="company-name-help" className="text-xs text-muted-foreground">
        Shown to teammates across the org and used in outreach scripts.
      </p>
      {error && (
        <p
          id="company-name-error"
          role="alert"
          className="text-sm text-destructive"
        >
          {error}
        </p>
      )}
      {saved && !error && (
        <p aria-hidden="true" className="text-xs font-medium text-growth-green">
          Saved
        </p>
      )}
      <span role="status" aria-live="polite" className="sr-only">
        {saved ? "Saved" : ""}
      </span>
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
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();
  const savedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
    };
  }, []);

  function save() {
    if (value.trim() === (displayName ?? "")) return;
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updateDisplayName(value);
      if (result.error) {
        setError(result.error);
        setValue(displayName ?? "");
        return;
      }
      setSaved(true);
      if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
      savedTimeoutRef.current = setTimeout(
        () => setSaved(false),
        SAVED_MESSAGE_DURATION_MS
      );
    });
  }

  return (
    <div className="flex flex-col gap-1">
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
        aria-describedby={
          error ? "display-name-help display-name-error" : "display-name-help"
        }
        aria-invalid={!!error}
      />
      <p id="display-name-help" className="text-xs text-muted-foreground">
        Signed as the recruiter in outreach scripts — only you can change
        this.
      </p>
      {error && (
        <p
          id="display-name-error"
          role="alert"
          className="text-sm text-destructive"
        >
          {error}
        </p>
      )}
      {saved && !error && (
        <p aria-hidden="true" className="text-xs font-medium text-growth-green">
          Saved
        </p>
      )}
      <span role="status" aria-live="polite" className="sr-only">
        {saved ? "Saved" : ""}
      </span>
    </div>
  );
}
