"use server";

// ⚠️ parseResume extracts resume text server-side, then calls the
// Anthropic API (an external, third-party service) on every invocation —
// flagged for rate-limiting review per SECURITY.md, same as
// generateSuggestedMessage in draft-actions.ts. Unlike that action, there
// is no existing per-org daily-count table to key a cap off of here
// (candidate_drafts logs every draft generation; nothing in
// ATS_FEATURES.md's Step 1 schema logs every parse) — adding one is out
// of scope for Step 3, which only asked for extraction + normalization,
// not new schema. This is flagged as a real gap, not silently worked
// around.
//
// Thin wrapper only — the actual parse-then-persist logic lives in
// resume-parse-core.ts (parseResumeAtPath / persistCandidateSkills),
// shared with the New Candidate form's uploadStagingResume
// (new-candidate-resume-actions.ts). This function's own contract
// (candidate_id in, parse-and-persist-immediately, same return shape) is
// unchanged from before that refactor.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  parseResumeAtPath,
  persistCandidateSkills,
} from "./resume-parse-core";

export type ParseResumeState = {
  error: string | null;
  result: {
    skillsAutoMatched: number;
    skillsForReview: number;
    locationMatched: boolean;
    locationRaw: string | null;
  } | null;
};

const candidatePath = (id: string) => `/talent-acquisition/candidates/${id}`;

// Same convention as draft-actions.ts / resume-actions.ts's requireUser().
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

export async function parseResume(candidateId: string): Promise<ParseResumeState> {
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

    const { data: candidateRow, error: candidateError } = await supabase
      .from("candidates")
      .select("id, org_id, resume_path")
      .eq("id", candidateId)
      .maybeSingle();
    if (candidateError || !candidateRow) {
      throw new Error("Not authorized");
    }
    // Authorization beyond RLS (SECURITY.md): this action's next steps are
    // a Storage download and a third-party API call, both real side
    // effects — same explicit org compare as uploadResume/
    // generateSuggestedMessage, not just implicit trust in RLS.
    if (candidateRow.org_id !== profile.org_id) {
      throw new Error("Not authorized");
    }

    const resumePath = candidateRow.resume_path as string | null;
    if (!resumePath) {
      return { error: "Upload a resume before parsing it.", result: null };
    }

    let parsed;
    try {
      parsed = await parseResumeAtPath(supabase, profile.org_id, resumePath);
    } catch (parseError) {
      // Fail securely — never forward a raw extraction/Anthropic error to
      // the client (SECURITY.md). Distinguish only the one case worth a
      // slightly different message (unreadable file) from everything else.
      if (parseError instanceof Error && parseError.message === "EMPTY_TEXT") {
        return {
          error: "Couldn't find any readable text in this resume.",
          result: null,
        };
      }
      console.error("Failed to parse resume:", parseError);
      return { error: "Couldn't parse this resume. Please try again.", result: null };
    }

    const { autoLinked, review } = await persistCandidateSkills(
      supabase,
      profile.org_id,
      candidateId,
      parsed.skills.map((s) => ({
        rawText: s.rawText,
        kind: s.kind,
        skillId: s.skillId,
        similarity: s.similarity,
      }))
    );

    let locationMatched = false;
    if (parsed.location.kind === "auto" && parsed.location.locationId) {
      const { error: locationUpdateError } = await supabase
        .from("candidates")
        .update({ location_id: parsed.location.locationId })
        .eq("id", candidateId);
      if (!locationUpdateError) {
        locationMatched = true;
      } else {
        console.error("Failed to set candidate location:", locationUpdateError);
      }
    }

    revalidatePath(candidatePath(candidateId));
    return {
      error: null,
      result: {
        skillsAutoMatched: autoLinked,
        skillsForReview: review,
        locationMatched,
        locationRaw: parsed.location.rawText,
      },
    };
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === "Not authenticated" || error.message === "Not authorized")
    ) {
      return { error: "Not authorized.", result: null };
    }
    console.error("Failed to parse resume:", error);
    return { error: "Couldn't parse this resume. Please try again.", result: null };
  }
}
