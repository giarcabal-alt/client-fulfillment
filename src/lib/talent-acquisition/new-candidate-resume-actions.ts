"use server";

// ⚠️ uploadStagingResume writes to Supabase Storage AND calls the
// Anthropic API (two external side effects) on every invocation —
// flagged for rate-limiting review per SECURITY.md, same convention as
// uploadResume/parseResume. No candidate exists yet at this point, so
// there's no candidate_id to key a cap off of — the same already-flagged
// gap as parseResume itself (see docs/PROJECT_STATE.md), not a new one
// introduced here.

import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { parseResumeAtPath, type ParsedResume } from "./resume-parse-core";

export type StagingUploadState = {
  error: string | null;
  stagingPath: string | null;
  parsed: ParsedResume | null;
};

// Mirrors resume-actions.ts's uploadResume exactly — same bucket, same
// size/type limits, same file_size_limit the `resumes` bucket itself
// enforces.
const MAX_RESUME_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES: Record<string, string> = {
  "application/pdf": ".pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
};

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

export async function uploadStagingResume(formData: FormData): Promise<StagingUploadState> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a file to upload.", stagingPath: null, parsed: null };
  }
  if (file.size > MAX_RESUME_SIZE_BYTES) {
    return { error: "That file is too large — 10MB max.", stagingPath: null, parsed: null };
  }
  const extension = ALLOWED_TYPES[file.type];
  if (!extension) {
    return { error: "Only PDF or DOCX files are accepted.", stagingPath: null, parsed: null };
  }

  try {
    const { supabase, user } = await requireUser();

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("org_id")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError || !profile) {
      throw new Error("Not authorized");
    }

    // Staging path: <org_id>/staging/<user_id>/<uuid><ext> — there's no
    // candidate_id yet, so this can't use uploadResume's
    // <org_id>/<candidate_id>/... convention. Still covered by the exact
    // same "resumes: insert/select within org" RLS policies without any
    // change: those only regex-guard-then-compare the *first* path
    // segment against current_org_id(), never inspecting what follows it
    // — see the grants/policy note in docs/CHANGELOG.md for this task, and
    // the UUID-cast-guard fragile-area note in PROJECT_STATE.md §10 for
    // why that first-segment check is written the way it is.
    const path = `${profile.org_id}/staging/${user.id}/${randomUUID()}${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("resumes")
      .upload(path, file, { contentType: file.type });
    if (uploadError) {
      console.error("Failed to upload staging resume:", uploadError);
      return { error: "Couldn't upload the resume. Please try again.", stagingPath: null, parsed: null };
    }

    let parsed: ParsedResume;
    try {
      parsed = await parseResumeAtPath(supabase, profile.org_id, path);
    } catch (parseError) {
      // The upload itself succeeded — only the parse step failed. This is
      // the expected failure mode right now (ANTHROPIC_WORKSPACE_ID isn't
      // set, see docs/PROJECT_STATE.md), not a new bug. Hand back the
      // staging path anyway so the form can still use the uploaded file
      // (as resume_path on final submit) even though autofill didn't
      // happen — manual entry stays fully available, per this task's
      // "must keep working exactly as it does today" requirement.
      console.error("Failed to parse staged resume:", parseError);
      return {
        error: "Uploaded, but couldn't read details from it — you can still fill in the rest manually.",
        stagingPath: path,
        parsed: null,
      };
    }

    return { error: null, stagingPath: path, parsed };
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === "Not authenticated" || error.message === "Not authorized")
    ) {
      return { error: "Not authorized.", stagingPath: null, parsed: null };
    }
    console.error("Failed to upload staging resume:", error);
    return { error: "Couldn't upload the resume. Please try again.", stagingPath: null, parsed: null };
  }
}
