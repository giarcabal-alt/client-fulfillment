"use server";

// ATS_FEATURES.md Prompt 5: interview scorecards, one row per interview
// conducted. interview_scorecards' RLS policy grants select + insert
// only (ATS_FEATURES.md Step 1 migration comment: "append-only") — there
// is deliberately no update/delete action here to mirror that; a
// scorecard, once submitted, stays exactly as recorded.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ScorecardActionState = { error: string | null };

const candidatePath = (id: string) => `/talent-acquisition/candidates/${id}`;

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

export async function addScorecard(
  candidateId: string,
  rating: number,
  notes: string
): Promise<ScorecardActionState> {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { error: "Choose a rating from 1 to 5." };
  }

  try {
    const { supabase, user } = await requireUser();

    // Re-derives the candidate's *current* stage server-side (never
    // trusts a client-sent value) for the stage_at_review snapshot. This
    // select is also the authorization-beyond-RLS check for candidateId:
    // candidates' own select policy already scopes rows to the caller's
    // org, so a candidateId from another org simply resolves to no row
    // here and fails closed below — same shape as assertRoleIsVisible/
    // assertLocationIsVisible in candidates-actions.ts.
    const { data: candidate, error: candidateError } = await supabase
      .from("candidates")
      .select("id, stage, org_id")
      .eq("id", candidateId)
      .maybeSingle();
    if (candidateError || !candidate) {
      return { error: "That candidate couldn't be found." };
    }

    const { error: insertError } = await supabase
      .from("interview_scorecards")
      .insert({
        org_id: candidate.org_id,
        candidate_id: candidateId,
        stage_at_review: candidate.stage,
        rating,
        notes: notes.trim() || null,
        interviewer_id: user.id,
      });
    if (insertError) throw insertError;

    revalidatePath(candidatePath(candidateId));
    return { error: null };
  } catch (error) {
    console.error("Failed to add scorecard:", error);
    return { error: "Couldn't save this scorecard. Please try again." };
  }
}
