"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { rejectCandidate } from "@/lib/talent-acquisition/candidates-actions";

// ATS_FEATURES.md Step 6's decline/reject flow. Once rejected, this is a
// read-only summary (no "unreject" action was asked for) — the reason is
// always visible here and in the separate rejected-candidates archive
// view, never just a raw DB column only visible via SQL.
export function RejectCandidatePanel({
  candidateId,
  status,
  declineReason,
}: {
  candidateId: string;
  status: "active" | "rejected";
  declineReason: string | null;
}) {
  const [isRejecting, setIsRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (status === "rejected") {
    return (
      <div className="flex flex-col gap-1 rounded-md border border-destructive/30 bg-destructive/5 p-3">
        <Badge variant="destructive" className="w-fit">
          Rejected
        </Badge>
        <p className="text-sm text-slate-text">
          {declineReason ?? "No reason recorded."}
        </p>
      </div>
    );
  }

  function submit() {
    // Client-side check is convenience only — rejectCandidate itself
    // re-validates the reason is non-empty server-side (SECURITY.md's
    // boundary-validation rule), so this can't be bypassed by skipping
    // the UI and calling the action directly.
    if (!reason.trim()) {
      setError("A decline reason is required.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await rejectCandidate(candidateId, reason);
      if (result.error) {
        setError(result.error);
      } else {
        setIsRejecting(false);
        setReason("");
      }
    });
  }

  if (!isRejecting) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-fit text-destructive hover:text-destructive"
        onClick={() => setIsRejecting(true)}
      >
        Reject candidate
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border p-3">
      <label
        htmlFor="decline-reason"
        className="text-xs uppercase tracking-wide text-muted-foreground"
      >
        Decline reason
      </label>
      <Textarea
        id="decline-reason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        disabled={isPending}
        rows={2}
        placeholder="Why is this candidate being rejected?"
        aria-required="true"
      />
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="destructive"
          size="sm"
          onClick={submit}
          disabled={isPending}
        >
          {isPending ? "Rejecting…" : "Confirm reject"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setIsRejecting(false);
            setReason("");
            setError(null);
          }}
          disabled={isPending}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
