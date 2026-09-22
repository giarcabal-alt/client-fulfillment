"use server";

import { revalidatePath } from "next/cache";
import { requireAdminUser } from "@/lib/auth/get-user-role";
import { createClient } from "@/lib/supabase/server";
import {
  finalizeSkillChips,
  persistCandidateSkills,
  type SubmittedSkillChip,
} from "@/lib/talent-acquisition/resume-parse-core";
import {
  EMPLOYMENT_STATUSES,
  NOTICE_PERIODS,
  type EmploymentStatus,
  type NoticePeriod,
} from "@/lib/talent-acquisition/employment-fields";
import {
  SOURCE_PLATFORMS,
  type SourcePlatform,
} from "@/lib/talent-acquisition/source-platforms";

export type CandidateActionState = { error: string | null };

const CANDIDATE_STAGES = [
  "talent_pool",
  "sourced",
  "contacted",
  "phone_screen",
  "interviewing",
  "offer",
  "onboarding",
] as const;
type CandidateStage = (typeof CANDIDATE_STAGES)[number];

export type RoleMode = "none" | "existing" | "new";

const BOARD_PATH = "/talent-acquisition/board";
const ROLES_PATH = "/talent-acquisition/roles";
// The standalone rejected-candidates archive page was consolidated into
// Talent Bench (pre-filtered to status='rejected') rather than kept as a
// second place showing the same information — revalidate that route
// instead of a now-deleted one.
const TALENT_BENCH_PATH = "/talent-acquisition/talent-bench";
const candidatePath = (id: string) => `/talent-acquisition/candidates/${id}`;

// Every action re-derives the user server-side via getUser() (never
// getSession(), never a client-passed id) per SECURITY.md. These are plain
// DB reads/writes with no external side effect, so RLS's org scoping is
// the authorization boundary.
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

// A role's RLS select policy governs direct access to the roles table, but
// it does NOT stop an arbitrary UUID from another org being accepted as a
// candidates.role_id foreign key value — the FK constraint only checks
// that a row exists, not that RLS would let this user see it. Re-using the
// scoped SELECT here as an explicit authorization check (rather than
// trusting the FK alone) is the "authorization beyond RLS" SECURITY.md
// calls for.
async function assertRoleIsVisible(
  supabase: Awaited<ReturnType<typeof requireUser>>,
  roleId: string
) {
  const { data, error } = await supabase
    .from("roles")
    .select("id")
    .eq("id", roleId)
    .maybeSingle();
  if (error || !data) {
    throw new Error("ROLE_NOT_FOUND");
  }
}

// Same shape as assertRoleIsVisible above, for candidates.location_id
// (ATS_FEATURES.md Step 1's `locations` table) — a scoped SELECT re-verifies
// the id is actually visible to this org before it's accepted as a
// foreign key, rather than trusting the FK constraint alone.
async function assertLocationIsVisible(
  supabase: Awaited<ReturnType<typeof requireUser>>,
  locationId: string
) {
  const { data, error } = await supabase
    .from("locations")
    .select("id")
    .eq("id", locationId)
    .maybeSingle();
  if (error || !data) {
    throw new Error("LOCATION_NOT_FOUND");
  }
}

// Parses the New Candidate form's optional `skills_json` field — a JSON
// array of SubmittedSkillChip built client-side from a staged resume
// parse (see new-candidate-resume-actions.ts / resume-parse.tsx). Never
// trusts it blindly: malformed JSON or a malformed entry is silently
// dropped (fails toward "no skills submitted", not toward crashing candidate
// creation over a client-side data problem) — the real security-relevant
// checks (does this skillId actually belong to this org) still happen
// later in persistCandidateSkills, not here.
function parseSubmittedSkillChips(raw: FormDataEntryValue | null): SubmittedSkillChip[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is SubmittedSkillChip => {
      return (
        typeof item === "object" &&
        item !== null &&
        typeof (item as SubmittedSkillChip).rawText === "string" &&
        typeof (item as SubmittedSkillChip).currentText === "string" &&
        ((item as SubmittedSkillChip).kind === "auto" ||
          (item as SubmittedSkillChip).kind === "review")
      );
    });
  } catch {
    return [];
  }
}

export async function createCandidate(
  _prevState: CandidateActionState,
  formData: FormData
): Promise<CandidateActionState> {
  const name = formData.get("name");
  const notes = formData.get("notes");
  const roleMode = formData.get("role_mode");
  const roleId = formData.get("role_id");
  const newRoleTitle = formData.get("new_role_title");
  const sourcePlatform = formData.get("source_platform");
  // All three optional, only present when a resume was uploaded+parsed in
  // the New Candidate form (see new-candidate-form.tsx) — manual entry
  // without a resume never sets any of these, so the rest of this
  // function behaves exactly as it did before this task.
  const stagedResumePath = formData.get("staged_resume_path");
  const locationId = formData.get("location_id");
  const skillChips = parseSubmittedSkillChips(formData.get("skills_json"));

  if (typeof name !== "string" || !name.trim()) {
    return { error: "Name is required." };
  }

  if (
    typeof sourcePlatform === "string" &&
    sourcePlatform &&
    !SOURCE_PLATFORMS.includes(sourcePlatform as SourcePlatform)
  ) {
    return { error: "Choose a valid source platform." };
  }

  if (roleMode !== "none" && roleMode !== "existing" && roleMode !== "new") {
    return { error: "Choose a role, create one, or leave it unset." };
  }

  if (roleMode === "existing" && (typeof roleId !== "string" || !roleId)) {
    return { error: "Choose a role." };
  }

  if (
    roleMode === "new" &&
    (typeof newRoleTitle !== "string" || !newRoleTitle.trim())
  ) {
    return { error: "Enter a title for the new role." };
  }

  try {
    const supabase = await requireUser();

    // No role picked: matches the prototype's talent-pool-by-default entry
    // point rather than dropping the candidate straight into "sourced"
    // with nothing to source them for.
    let finalRoleId: string | null = null;
    let stage: CandidateStage = "sourced";

    if (roleMode === "none") {
      finalRoleId = null;
      stage = "talent_pool";
    } else if (roleMode === "existing") {
      await assertRoleIsVisible(supabase, roleId as string);
      finalRoleId = roleId as string;
    } else {
      const { data: newRole, error: roleError } = await supabase
        .from("roles")
        .insert({ title: (newRoleTitle as string).trim() })
        .select("id")
        .single();
      if (roleError || !newRole) {
        throw roleError ?? new Error("Role creation returned no row");
      }
      finalRoleId = newRole.id as string;
    }

    // Resume/skills/location only ever come from the New Candidate form's
    // optional resume-upload-with-autofill path (this task's addition) —
    // every field here defaults to exactly what plain manual entry already
    // inserted before this task, unchanged.
    let finalLocationId: string | null = null;
    if (typeof locationId === "string" && locationId) {
      await assertLocationIsVisible(supabase, locationId);
      finalLocationId = locationId;
    }

    // Authorization beyond RLS (SECURITY.md): staged_resume_path is a
    // client-supplied storage path, not something this action generated
    // itself — verify its leading org_id segment actually matches the
    // caller's own org before accepting it, rather than trusting it
    // blindly. A path that fails this check is silently dropped (no
    // resume attached) rather than failing the whole candidate creation,
    // the same "fail toward the safe, degraded case" choice
    // uploadStagingResume itself makes when parsing fails but the upload
    // succeeded.
    let finalResumePath: string | null = null;
    if (typeof stagedResumePath === "string" && stagedResumePath) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from("profiles")
        .select("org_id")
        .eq("id", user?.id ?? "")
        .maybeSingle();
      if (profile && stagedResumePath.startsWith(`${profile.org_id}/staging/`)) {
        finalResumePath = stagedResumePath;
      } else {
        console.error(
          "Ignored staged_resume_path — org prefix didn't match the caller's own org"
        );
      }
    }

    // Skills go straight to candidate_skills (below), never mirrored into
    // the tags column — tags dropped out of the candidate UI entirely in
    // favor of confirmed skills as the structured source (see
    // PROJECT_STATE.md §4); `finalizeSkillChips` still returns
    // `confirmedNames` for that persistence step, just no longer for a
    // tags string.
    const { persist: skillsToPersist } = finalizeSkillChips(skillChips);

    const { data: newCandidate, error } = await supabase
      .from("candidates")
      .insert({
        name: name.trim(),
        role_id: finalRoleId,
        stage,
        notes: typeof notes === "string" && notes.trim() ? notes.trim() : null,
        source_platform:
          typeof sourcePlatform === "string" && sourcePlatform
            ? sourcePlatform
            : null,
        resume_path: finalResumePath,
        location_id: finalLocationId,
      })
      .select("id, org_id")
      .single();
    if (error || !newCandidate) throw error ?? new Error("Candidate creation returned no row");

    if (skillsToPersist.length > 0) {
      await persistCandidateSkills(
        supabase,
        newCandidate.org_id as string,
        newCandidate.id as string,
        skillsToPersist
      );
    }
  } catch (error) {
    if (error instanceof Error && error.message === "ROLE_NOT_FOUND") {
      return { error: "That role couldn't be found." };
    }
    if (error instanceof Error && error.message === "LOCATION_NOT_FOUND") {
      return { error: "That location couldn't be found." };
    }
    // Fail securely — never surface raw Postgres/schema errors (SECURITY.md).
    console.error("Failed to create candidate:", error);
    return { error: "Couldn't add the candidate. Please try again." };
  }

  revalidatePath(BOARD_PATH);
  revalidatePath(ROLES_PATH);
  return { error: null };
}

export async function updateCandidateStage(
  id: string,
  stage: string
): Promise<CandidateActionState> {
  if (!CANDIDATE_STAGES.includes(stage as CandidateStage)) {
    return { error: "Not a valid stage." };
  }

  try {
    const supabase = await requireUser();

    const { data: candidate, error: fetchError } = await supabase
      .from("candidates")
      .select("stage")
      .eq("id", id)
      .maybeSingle();
    if (fetchError || !candidate) {
      throw fetchError ?? new Error("Candidate not found");
    }
    if (candidate.stage === stage) {
      return { error: null };
    }

    const now = new Date().toISOString();
    // Matches the prototype's moveStage(): entering a new stage resets the
    // touch/cadence clock, not just the stage label itself.
    const { error } = await supabase
      .from("candidates")
      .update({
        stage,
        stage_entered_at: now,
        last_action_at: now,
        touch_index: 0,
      })
      .eq("id", id);
    if (error) throw error;

    const { error: historyError } = await supabase
      .from("candidate_history")
      .insert({ candidate_id: id, label: `Moved to ${stage}` });
    if (historyError) {
      // Non-fatal — the stage change itself succeeded.
      console.error("Failed to record candidate history:", historyError);
    }
  } catch (error) {
    console.error("Failed to update candidate stage:", error);
    return { error: "Couldn't update the stage. Please try again." };
  }

  revalidatePath(BOARD_PATH);
  revalidatePath(candidatePath(id));
  return { error: null };
}

export async function updateCandidateNotes(
  id: string,
  notes: string
): Promise<CandidateActionState> {
  try {
    const supabase = await requireUser();
    const { error } = await supabase
      .from("candidates")
      .update({ notes: notes.trim() || null })
      .eq("id", id);
    if (error) throw error;
  } catch (error) {
    console.error("Failed to update candidate notes:", error);
    return { error: "Couldn't save the notes. Please try again." };
  }

  revalidatePath(BOARD_PATH);
  revalidatePath(candidatePath(id));
  return { error: null };
}


export async function reassignCandidateRole(
  id: string,
  roleId: string | null
): Promise<CandidateActionState> {
  try {
    const supabase = await requireUser();
    if (roleId) {
      await assertRoleIsVisible(supabase, roleId);
    }
    const { error } = await supabase
      .from("candidates")
      .update({ role_id: roleId })
      .eq("id", id);
    if (error) throw error;
  } catch (error) {
    if (error instanceof Error && error.message === "ROLE_NOT_FOUND") {
      return { error: "That role couldn't be found." };
    }
    console.error("Failed to reassign candidate role:", error);
    return { error: "Couldn't reassign the role. Please try again." };
  }

  revalidatePath(BOARD_PATH);
  revalidatePath(ROLES_PATH);
  revalidatePath(candidatePath(id));
  return { error: null };
}

export async function updateCandidateSourcePlatform(
  id: string,
  sourcePlatform: string | null
): Promise<CandidateActionState> {
  if (
    sourcePlatform !== null &&
    !SOURCE_PLATFORMS.includes(sourcePlatform as SourcePlatform)
  ) {
    return { error: "Choose a valid source platform." };
  }

  try {
    const supabase = await requireUser();
    const { error } = await supabase
      .from("candidates")
      .update({ source_platform: sourcePlatform })
      .eq("id", id);
    if (error) throw error;
  } catch (error) {
    console.error("Failed to update candidate source platform:", error);
    return { error: "Couldn't save the source. Please try again." };
  }

  revalidatePath(BOARD_PATH);
  revalidatePath(candidatePath(id));
  return { error: null };
}

export async function updateCandidateCommunicationRating(
  id: string,
  rating: number | null
): Promise<CandidateActionState> {
  if (rating !== null && (!Number.isInteger(rating) || rating < 1 || rating > 5)) {
    return { error: "Rating must be 1–5." };
  }

  try {
    const supabase = await requireUser();
    const { error } = await supabase
      .from("candidates")
      .update({ communication_rating: rating })
      .eq("id", id);
    if (error) throw error;
  } catch (error) {
    console.error("Failed to update candidate communication rating:", error);
    return { error: "Couldn't save the rating. Please try again." };
  }

  revalidatePath(BOARD_PATH);
  revalidatePath(candidatePath(id));
  return { error: null };
}

// Admin-only: who a candidate is currently owned by. Two checks, per
// SECURITY.md's authorization-beyond-RLS rule and step 3 of the
// admin/assignment feature (PROJECT_STATE.md §6): (1) requireAdminUser()
// — RLS's "candidates: update within org" policy already lets *any* org
// member write any column on a candidate, `assigned_to` included, so
// nothing in the database itself stops a non-admin from calling this;
// the role check is the only thing that does. (2) the target profile is
// re-verified as actually visible to this caller (via the normal,
// RLS-scoped client's "profiles: select own org" policy) before being
// accepted — same shape as assertRoleIsVisible above for role_id: a FK
// constraint alone only checks the row exists, not that this org would
// recognize it as a teammate.
export async function updateCandidateAssignment(
  id: string,
  assignedTo: string | null
): Promise<CandidateActionState> {
  try {
    await requireAdminUser();
    const supabase = await requireUser();

    if (assignedTo) {
      const { data, error } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", assignedTo)
        .maybeSingle();
      if (error || !data) {
        throw new Error("ASSIGNEE_NOT_FOUND");
      }
    }

    const { error } = await supabase
      .from("candidates")
      .update({ assigned_to: assignedTo })
      .eq("id", id);
    if (error) throw error;
  } catch (error) {
    if (error instanceof Error && error.message === "ASSIGNEE_NOT_FOUND") {
      return { error: "That teammate couldn't be found." };
    }
    if (
      error instanceof Error &&
      (error.message === "Not authenticated" || error.message === "Not authorized")
    ) {
      return { error: "Not authorized." };
    }
    console.error("Failed to update candidate assignment:", error);
    return { error: "Couldn't update the assignment. Please try again." };
  }

  revalidatePath(BOARD_PATH);
  revalidatePath(candidatePath(id));
  return { error: null };
}

// Added alongside resume-upload-with-autofill (ATS_FEATURES.md Step 3
// follow-up): location_id was previously only ever set by parseResume's
// auto-match path, with nothing on the candidate detail page to view or
// correct it — data only visible via direct SQL otherwise. Same
// authorization-beyond-RLS shape as reassignCandidateRole for role_id.
export async function updateCandidateLocation(
  id: string,
  locationId: string | null
): Promise<CandidateActionState> {
  try {
    const supabase = await requireUser();
    if (locationId) {
      await assertLocationIsVisible(supabase, locationId);
    }
    const { error } = await supabase
      .from("candidates")
      .update({ location_id: locationId })
      .eq("id", id);
    if (error) throw error;
  } catch (error) {
    if (error instanceof Error && error.message === "LOCATION_NOT_FOUND") {
      return { error: "That location couldn't be found." };
    }
    console.error("Failed to update candidate location:", error);
    return { error: "Couldn't update the location. Please try again." };
  }

  revalidatePath(BOARD_PATH);
  revalidatePath(candidatePath(id));
  return { error: null };
}

// ATS_FEATURES.md Step 6: decline/reject flow. `status` is orthogonal to
// the pipeline `stage` (ATS_FEATURES.md's own "candidate status vs. stage"
// architecture decision, see PROJECT_STATE.md §10/§4 — Step 1's schema
// migration) — rejecting a candidate never touches `stage`, so it stays
// exactly where the candidate was ("last stage before rejection") for the
// rejected-candidates view to show. A non-empty decline reason is
// required and validated here, server-side, not just in the client form —
// SECURITY.md's boundary-validation rule: a client-side-only check can
// always be bypassed by calling the Server Action directly.
export async function rejectCandidate(
  id: string,
  declineReason: string
): Promise<CandidateActionState> {
  const reason = declineReason.trim();
  if (!reason) {
    return { error: "A decline reason is required." };
  }

  try {
    const supabase = await requireUser();
    const { error } = await supabase
      .from("candidates")
      .update({ status: "rejected", decline_reason: reason })
      .eq("id", id);
    if (error) throw error;
  } catch (error) {
    console.error("Failed to reject candidate:", error);
    return { error: "Couldn't reject this candidate. Please try again." };
  }

  revalidatePath(BOARD_PATH);
  revalidatePath(TALENT_BENCH_PATH);
  revalidatePath(candidatePath(id));
  return { error: null };
}

// Talent Bench fields (see the migration adding years_experience/
// last_role/last_company/employment_status/notice_period/
// expected_compensation to `candidates`) — six independent save-on-blur/
// on-change fields on the candidate detail page, same one-action-per-field
// shape as notes/tags/source_platform above. All optional; none of these
// block candidate creation or any other existing flow.

export async function updateCandidateYearsExperience(
  id: string,
  years: number | null
): Promise<CandidateActionState> {
  if (years !== null && (!Number.isFinite(years) || years < 0)) {
    return { error: "Years of experience must be a non-negative number." };
  }

  try {
    const supabase = await requireUser();
    const { error } = await supabase
      .from("candidates")
      .update({ years_experience: years })
      .eq("id", id);
    if (error) throw error;
  } catch (error) {
    console.error("Failed to update years of experience:", error);
    return { error: "Couldn't save years of experience. Please try again." };
  }

  revalidatePath(TALENT_BENCH_PATH);
  revalidatePath(candidatePath(id));
  return { error: null };
}

export async function updateCandidateLastRole(
  id: string,
  lastRole: string
): Promise<CandidateActionState> {
  try {
    const supabase = await requireUser();
    const { error } = await supabase
      .from("candidates")
      .update({ last_role: lastRole.trim() || null })
      .eq("id", id);
    if (error) throw error;
  } catch (error) {
    console.error("Failed to update last role:", error);
    return { error: "Couldn't save the last role. Please try again." };
  }

  revalidatePath(TALENT_BENCH_PATH);
  revalidatePath(candidatePath(id));
  return { error: null };
}

export async function updateCandidateLastCompany(
  id: string,
  lastCompany: string
): Promise<CandidateActionState> {
  try {
    const supabase = await requireUser();
    const { error } = await supabase
      .from("candidates")
      .update({ last_company: lastCompany.trim() || null })
      .eq("id", id);
    if (error) throw error;
  } catch (error) {
    console.error("Failed to update last company:", error);
    return { error: "Couldn't save the last company. Please try again." };
  }

  revalidatePath(TALENT_BENCH_PATH);
  revalidatePath(candidatePath(id));
  return { error: null };
}

export async function updateCandidateEmploymentStatus(
  id: string,
  employmentStatus: string | null
): Promise<CandidateActionState> {
  if (
    employmentStatus !== null &&
    !EMPLOYMENT_STATUSES.includes(employmentStatus as EmploymentStatus)
  ) {
    return { error: "Choose a valid employment status." };
  }

  try {
    const supabase = await requireUser();
    const { error } = await supabase
      .from("candidates")
      .update({ employment_status: employmentStatus })
      .eq("id", id);
    if (error) throw error;
  } catch (error) {
    console.error("Failed to update employment status:", error);
    return { error: "Couldn't save employment status. Please try again." };
  }

  revalidatePath(TALENT_BENCH_PATH);
  revalidatePath(candidatePath(id));
  return { error: null };
}

export async function updateCandidateNoticePeriod(
  id: string,
  noticePeriod: string | null
): Promise<CandidateActionState> {
  if (
    noticePeriod !== null &&
    !NOTICE_PERIODS.includes(noticePeriod as NoticePeriod)
  ) {
    return { error: "Choose a valid notice period." };
  }

  try {
    const supabase = await requireUser();
    const { error } = await supabase
      .from("candidates")
      .update({ notice_period: noticePeriod })
      .eq("id", id);
    if (error) throw error;
  } catch (error) {
    console.error("Failed to update notice period:", error);
    return { error: "Couldn't save the notice period. Please try again." };
  }

  revalidatePath(TALENT_BENCH_PATH);
  revalidatePath(candidatePath(id));
  return { error: null };
}

export async function updateCandidateExpectedCompensation(
  id: string,
  expectedCompensation: string
): Promise<CandidateActionState> {
  try {
    const supabase = await requireUser();
    const { error } = await supabase
      .from("candidates")
      .update({ expected_compensation: expectedCompensation.trim() || null })
      .eq("id", id);
    if (error) throw error;
  } catch (error) {
    console.error("Failed to update expected compensation:", error);
    return { error: "Couldn't save expected compensation. Please try again." };
  }

  revalidatePath(TALENT_BENCH_PATH);
  revalidatePath(candidatePath(id));
  return { error: null };
}
