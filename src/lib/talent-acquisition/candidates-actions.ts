"use server";

import { revalidatePath } from "next/cache";
import { requireAdminUser } from "@/lib/auth/get-user-role";
import { createClient } from "@/lib/supabase/server";

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

export async function createCandidate(
  _prevState: CandidateActionState,
  formData: FormData
): Promise<CandidateActionState> {
  const name = formData.get("name");
  const notes = formData.get("notes");
  const tags = formData.get("tags");
  const roleMode = formData.get("role_mode");
  const roleId = formData.get("role_id");
  const newRoleTitle = formData.get("new_role_title");

  if (typeof name !== "string" || !name.trim()) {
    return { error: "Name is required." };
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

    const { error } = await supabase.from("candidates").insert({
      name: name.trim(),
      role_id: finalRoleId,
      stage,
      notes: typeof notes === "string" && notes.trim() ? notes.trim() : null,
      tags: typeof tags === "string" && tags.trim() ? tags.trim() : null,
    });
    if (error) throw error;
  } catch (error) {
    if (error instanceof Error && error.message === "ROLE_NOT_FOUND") {
      return { error: "That role couldn't be found." };
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

export async function updateCandidateTags(
  id: string,
  tags: string
): Promise<CandidateActionState> {
  try {
    const supabase = await requireUser();
    const { error } = await supabase
      .from("candidates")
      .update({ tags: tags.trim() || null })
      .eq("id", id);
    if (error) throw error;
  } catch (error) {
    console.error("Failed to update candidate tags:", error);
    return { error: "Couldn't save the tags. Please try again." };
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
