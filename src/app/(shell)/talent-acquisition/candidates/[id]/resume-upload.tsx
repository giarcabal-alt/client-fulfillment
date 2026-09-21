"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { uploadResume } from "@/lib/talent-acquisition/resume-actions";

const ACCEPTED_TYPES =
  "application/pdf,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx";

// No local copy of `resumeUrl` — always read straight from the prop.
// revalidatePath() inside uploadResume() re-renders the server component
// this is nested under with fresh data, which flips this component from
// the upload input to the "View resume" link automatically once that
// lands; that transition is itself the success confirmation (the same
// reasoning as deleteUser's row disappearing from the admin list), so
// there's no separate "uploaded" toast state to keep in sync with it.
export function ResumeUpload({
  candidateId,
  resumeUrl,
}: {
  candidateId: string;
  resumeUrl: string | null;
}) {
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setFileName(file.name);
    const formData = new FormData();
    formData.set("file", file);
    startTransition(async () => {
      const result = await uploadResume(candidateId, formData);
      if (result.error) {
        setError(result.error);
      } else {
        // Success: the "View resume" link (driven by the resumeUrl prop,
        // refreshed via revalidatePath) is the confirmation now — no need
        // for the transient filename to keep showing alongside it. On
        // failure it stays, so the error is legible next to what failed.
        setFileName(null);
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {resumeUrl && (
        <a
          href={resumeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-fit text-sm text-work-blue underline"
        >
          View resume →
        </a>
      )}

      <div className="flex flex-col gap-1.5">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          {resumeUrl ? "Replace resume (PDF or DOCX)" : "Resume (PDF or DOCX)"}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isPending}
            aria-label={resumeUrl ? "Choose replacement resume file" : "Choose resume file"}
            className="w-fit"
          >
            Choose file
          </Button>
          {fileName && (
            <span className="min-w-0 truncate text-sm text-slate-text">
              {fileName}
            </span>
          )}
        </div>
        {/* `hidden` (display:none), not `sr-only` — this input is never
            meant to be its own tab stop. The Button above is the single
            real, keyboard-operable trigger (native <button>, so Enter/
            Space activate it for free); an sr-only input would still sit
            in the tab order as an invisible, confusing second stop right
            next to it. Triggered entirely via fileInputRef.current.click(). */}
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES}
          onChange={handleFileChange}
          disabled={isPending}
          tabIndex={-1}
          aria-hidden="true"
          className="hidden"
        />
      </div>

      {isPending && (
        <p className="text-sm text-muted-foreground">Uploading…</p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
