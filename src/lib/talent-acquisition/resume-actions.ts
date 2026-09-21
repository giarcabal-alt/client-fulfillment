"use server";

// ⚠️ uploadResume writes to Supabase Storage — a non-DB, external side
// effect on every call. Flagged for rate-limiting review per
// SECURITY.md, same convention as inviteUser/resetUserPassword/
// generateSuggestedMessage.

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ResumeActionState = { error: string | null };

const candidatePath = (id: string) => `/talent-acquisition/candidates/${id}`;

// Matches the `resumes` bucket's own file_size_limit (see the storage
// migration) — checked here too so a too-large file gets a clear,
// friendly message instead of Supabase Storage's own rejection error.
const MAX_RESUME_SIZE_BYTES = 10 * 1024 * 1024;

const ALLOWED_TYPES: Record<string, string> = {
  "application/pdf": ".pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
};

// Same convention as candidates-actions.ts's requireUser() — re-derives
// the user server-side via getUser() (never getSession(), never a
// client-passed id) per SECURITY.md.
async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Not authenticated");
  }
  return { supabase, user };
}

export async function uploadResume(
  candidateId: string,
  formData: FormData
): Promise<ResumeActionState> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a file to upload." };
  }
  if (file.size > MAX_RESUME_SIZE_BYTES) {
    return { error: "That file is too large — 10MB max." };
  }
  const extension = ALLOWED_TYPES[file.type];
  if (!extension) {
    return { error: "Only PDF or DOCX files are accepted." };
  }

  try {
    const { supabase, user } = await requireUser();

    // Authorization beyond RLS (SECURITY.md): writing to Storage is a
    // non-DB side effect, so — same shape as generateSuggestedMessage's
    // org compare — this needs its own explicit check, not just an
    // implicit reliance on the scoped candidate SELECT below already
    // returning nothing for a row RLS would hide.
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("org_id")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError || !profile) {
      throw new Error("Not authorized");
    }

    const { data: candidateRow, error: candidateError } = await supabase
      .from("candidates")
      .select("id, org_id")
      .eq("id", candidateId)
      .maybeSingle();
    if (candidateError || !candidateRow) {
      throw new Error("Not authorized");
    }
    if (candidateRow.org_id !== profile.org_id) {
      throw new Error("Not authorized");
    }

    // Path convention the storage.objects RLS policies key off:
    // <org_id>/<candidate_id>/<random-uuid><ext>. The random filename —
    // not the original, possibly PII-bearing, user-supplied one — avoids
    // collisions and keeps the object name itself free of anything worth
    // protecting on its own.
    const path = `${profile.org_id}/${candidateId}/${randomUUID()}${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("resumes")
      .upload(path, file, { contentType: file.type });
    if (uploadError) throw uploadError;

    // A "replace" is a fresh upload under a new path, not an in-place
    // overwrite — the previous object (if any) is simply left orphaned
    // in storage. No cleanup step exists yet; this is a known gap for a
    // later step, not an oversight (see docs/PROJECT_STATE.md).
    const { error: updateError } = await supabase
      .from("candidates")
      .update({ resume_path: path })
      .eq("id", candidateId);
    if (updateError) throw updateError;
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === "Not authenticated" || error.message === "Not authorized")
    ) {
      return { error: "Not authorized." };
    }
    console.error("Failed to upload resume:", error);
    return { error: "Couldn't upload the resume. Please try again." };
  }

  revalidatePath(candidatePath(candidateId));
  return { error: null };
}
