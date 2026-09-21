"use client";

import { useRef, useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
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
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    const formData = new FormData();
    formData.set("file", file);
    startTransition(async () => {
      const result = await uploadResume(candidateId, formData);
      if (result.error) {
        setError(result.error);
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

      <label className="flex flex-col gap-1.5">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          {resumeUrl ? "Replace resume (PDF or DOCX)" : "Resume (PDF or DOCX)"}
        </span>
        <Input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES}
          onChange={handleFileChange}
          disabled={isPending}
          aria-label={resumeUrl ? "Replace resume" : "Resume file"}
          className="max-w-xs"
        />
      </label>

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
