"use server";

// Actions for ATS_FEATURES.md Prompt 4's "Needs Review" panel: confirm a
// candidate_skill_reviews row's suggested skill, reject it outright, or
// map it to a different existing skill. Plain DB reads/writes with no
// external side effect (no third-party API call, no email, no Storage
// write) — RLS's org scoping is the authorization boundary here, same as
// candidates-actions.ts's stage/notes/tags updates, not the
// authorization-beyond-RLS shape uploadResume/parseResume need.
//
// The one thing that DOES need an explicit check beyond RLS: a
// caller-supplied skillId (from confirm's suggested_skill_id, or map's
// user-chosen one) must be re-verified as visible to this org before
// being written into candidate_skills — candidate_skills' own RLS policy
// only checks the candidate row's org, not the skill row's (see
// PROJECT_STATE.md §10). Reuses persistCandidateSkills
// (resume-parse-core.ts) for that exact check rather than duplicating it.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { persistCandidateSkills } from "./resume-parse-core";

export type SkillReviewActionState = { error: string | null };

const candidatePath = (id: string) => `/talent-acquisition/candidates/${id}`;

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Not authenticated");
  }
  return supabase;
}

async function loadPendingReview(
  supabase: Awaited<ReturnType<typeof requireUser>>,
  reviewId: string
) {
  const { data, error } = await supabase
    .from("candidate_skill_reviews")
    .select("id, candidate_id, org_id, suggested_skill_id, status")
    .eq("id", reviewId)
    .maybeSingle();
  if (error || !data) {
    throw new Error("REVIEW_NOT_FOUND");
  }
  return data;
}

export async function confirmSkillReview(reviewId: string): Promise<SkillReviewActionState> {
  try {
    const supabase = await requireUser();
    const review = await loadPendingReview(supabase, reviewId);
    if (review.status !== "pending") {
      // Already handled (e.g. a second click before the page refreshed) —
      // treat as a harmless no-op, not an error to surface.
      return { error: null };
    }
    if (!review.suggested_skill_id) {
      return {
        error: "There's no suggested skill to confirm — map it to a skill instead.",
      };
    }

    const { autoLinked } = await persistCandidateSkills(
      supabase,
      review.org_id as string,
      review.candidate_id as string,
      [
        {
          rawText: "",
          kind: "auto",
          skillId: review.suggested_skill_id as string,
          similarity: null,
        },
      ]
    );
    if (autoLinked === 0) {
      return { error: "That skill couldn't be found. Please try again." };
    }

    const { error: updateError } = await supabase
      .from("candidate_skill_reviews")
      .update({ status: "confirmed" })
      .eq("id", reviewId);
    if (updateError) throw updateError;

    revalidatePath(candidatePath(review.candidate_id as string));
    return { error: null };
  } catch (error) {
    if (error instanceof Error && error.message === "REVIEW_NOT_FOUND") {
      return { error: "That review item couldn't be found." };
    }
    console.error("Failed to confirm skill review:", error);
    return { error: "Couldn't confirm this skill. Please try again." };
  }
}

export async function rejectSkillReview(reviewId: string): Promise<SkillReviewActionState> {
  try {
    const supabase = await requireUser();
    const review = await loadPendingReview(supabase, reviewId);
    if (review.status !== "pending") {
      return { error: null };
    }

    const { error: updateError } = await supabase
      .from("candidate_skill_reviews")
      .update({ status: "rejected" })
      .eq("id", reviewId);
    if (updateError) throw updateError;

    revalidatePath(candidatePath(review.candidate_id as string));
    return { error: null };
  } catch (error) {
    if (error instanceof Error && error.message === "REVIEW_NOT_FOUND") {
      return { error: "That review item couldn't be found." };
    }
    console.error("Failed to reject skill review:", error);
    return { error: "Couldn't reject this item. Please try again." };
  }
}

export async function mapSkillReview(
  reviewId: string,
  skillId: string
): Promise<SkillReviewActionState> {
  if (!skillId) {
    return { error: "Choose a skill first." };
  }

  try {
    const supabase = await requireUser();
    const review = await loadPendingReview(supabase, reviewId);
    if (review.status !== "pending") {
      return { error: null };
    }

    const { autoLinked } = await persistCandidateSkills(
      supabase,
      review.org_id as string,
      review.candidate_id as string,
      [{ rawText: "", kind: "auto", skillId, similarity: null }]
    );
    if (autoLinked === 0) {
      return { error: "That skill couldn't be found. Please try again." };
    }

    // Updates suggested_skill_id to the skill it actually ended up mapped
    // to — keeps the row an accurate record of the final outcome, not
    // just the model's original (possibly wrong) suggestion.
    const { error: updateError } = await supabase
      .from("candidate_skill_reviews")
      .update({ status: "confirmed", suggested_skill_id: skillId })
      .eq("id", reviewId);
    if (updateError) throw updateError;

    revalidatePath(candidatePath(review.candidate_id as string));
    return { error: null };
  } catch (error) {
    if (error instanceof Error && error.message === "REVIEW_NOT_FOUND") {
      return { error: "That review item couldn't be found." };
    }
    console.error("Failed to map skill review:", error);
    return { error: "Couldn't map this skill. Please try again." };
  }
}
