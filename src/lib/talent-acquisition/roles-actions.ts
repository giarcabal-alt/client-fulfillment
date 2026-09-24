"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  finalizeSkillChips,
  type SkillMatch,
  type SubmittedSkillChip,
} from "./resume-parse-core";
import { parseJobDescriptionSkills, persistRoleSkills } from "./role-jd-parse-core";
import {
  PAYMENT_TERMS,
  ROLE_PRIORITIES,
  SENIORITY_LEVELS,
  WORK_ARRANGEMENTS,
  type PaymentTerms,
  type RolePriority,
  type SeniorityLevel,
  type WorkArrangement,
} from "./role-fields";

export type RoleActionState = { error: string | null };

const ROLE_STATUSES = ["open", "filled", "closed"] as const;
type RoleStatus = (typeof ROLE_STATUSES)[number];

const ROLE_CLASSIFICATIONS = ["embedded_operator", "project_based"] as const;
type RoleClassification = (typeof ROLE_CLASSIFICATIONS)[number];

const ROLES_PATH = "/talent-acquisition/roles";
const rolePath = (id: string) => `/talent-acquisition/roles/${id}`;

// Every action re-derives the user server-side via getUser() (never
// getSession(), never a client-passed user id) per SECURITY.md. These are
// plain DB reads/writes with no external side effect, so RLS's org
// scoping is the authorization boundary — no additional check is needed
// beyond confirming someone is signed in.
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

// Re-verifies a client-supplied client_id against the caller's own org
// before accepting it — same authorization-beyond-RLS pattern as
// candidates-actions.ts's assertRoleIsVisible/assertLocationIsVisible
// (PROJECT_STATE.md §10): a FK constraint only checks the row exists, not
// whether the caller is allowed to see it.
async function assertClientIsVisible(
  supabase: Awaited<ReturnType<typeof requireUser>>,
  clientId: string
) {
  const { data, error } = await supabase
    .from("clients")
    .select("id")
    .eq("id", clientId)
    .maybeSingle();
  if (error || !data) {
    throw new Error("CLIENT_NOT_FOUND");
  }
}

function optionalTrimmed(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

// Parses the create form's optional `skills_json` field — a JSON array of
// SubmittedSkillChip, exactly the same shape and helper
// (finalizeSkillChips, resume-parse-core.ts) the New Candidate form's
// staged resume-autofill skills already use. Reused as-is rather than
// duplicated: the "edit/remove staged chips before the parent record
// exists yet, persist them together with it on submit" shape is
// identical here, just for a role's JD-parsed skills instead of a
// candidate's resume-parsed ones.
function parseSubmittedSkillChips(raw: FormDataEntryValue | null): SubmittedSkillChip[] {
  if (typeof raw !== "string" || !raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (chip): chip is SubmittedSkillChip =>
        typeof chip === "object" &&
        chip !== null &&
        typeof (chip as SubmittedSkillChip).rawText === "string" &&
        typeof (chip as SubmittedSkillChip).currentText === "string"
    );
  } catch {
    return [];
  }
}

export async function createRole(
  _prevState: RoleActionState,
  formData: FormData
): Promise<RoleActionState> {
  const title = formData.get("title");
  const classification = formData.get("classification");
  const clientMode = formData.get("client_mode");
  const clientId = formData.get("client_id");
  const newClientName = formData.get("new_client_name");
  const paymentTerms = formData.get("payment_terms");
  const seniorityLevel = formData.get("seniority_level");
  const workArrangement = formData.get("work_arrangement");
  const priority = formData.get("priority");
  const targetFillDate = formData.get("target_fill_date");
  const skillChips = parseSubmittedSkillChips(formData.get("skills_json"));

  if (typeof title !== "string" || !title.trim()) {
    return { error: "Title is required." };
  }

  if (
    typeof classification === "string" &&
    classification &&
    !ROLE_CLASSIFICATIONS.includes(classification as RoleClassification)
  ) {
    return { error: "Choose a valid classification." };
  }
  if (
    typeof paymentTerms === "string" &&
    paymentTerms &&
    !PAYMENT_TERMS.includes(paymentTerms as PaymentTerms)
  ) {
    return { error: "Choose valid payment terms." };
  }
  if (
    typeof seniorityLevel === "string" &&
    seniorityLevel &&
    !SENIORITY_LEVELS.includes(seniorityLevel as SeniorityLevel)
  ) {
    return { error: "Choose a valid seniority level." };
  }
  if (
    typeof workArrangement === "string" &&
    workArrangement &&
    !WORK_ARRANGEMENTS.includes(workArrangement as WorkArrangement)
  ) {
    return { error: "Choose a valid work arrangement." };
  }
  if (
    typeof priority === "string" &&
    priority &&
    !ROLE_PRIORITIES.includes(priority as RolePriority)
  ) {
    return { error: "Choose a valid priority." };
  }
  if (clientMode !== "none" && clientMode !== "existing" && clientMode !== "new") {
    return { error: "Choose a client, add one, or leave it unset." };
  }
  if (clientMode === "existing" && (typeof clientId !== "string" || !clientId)) {
    return { error: "Choose a client." };
  }
  if (
    clientMode === "new" &&
    (typeof newClientName !== "string" || !newClientName.trim())
  ) {
    return { error: "Enter a company name for the new client." };
  }

  try {
    const supabase = await requireUser();

    let finalClientId: string | null = null;
    if (clientMode === "existing") {
      await assertClientIsVisible(supabase, clientId as string);
      finalClientId = clientId as string;
    } else if (clientMode === "new") {
      const { data: newClientRow, error: clientError } = await supabase
        .from("clients")
        .insert({ company_name: (newClientName as string).trim() })
        .select("id")
        .single();
      if (clientError || !newClientRow) {
        throw clientError ?? new Error("Client creation returned no row");
      }
      finalClientId = newClientRow.id as string;
    }

    const { data: newRole, error } = await supabase
      .from("roles")
      .insert({
        title: title.trim(),
        job_description: optionalTrimmed(formData, "job_description"),
        timezone_overlap: optionalTrimmed(formData, "timezone_overlap"),
        classification:
          typeof classification === "string" && classification ? classification : null,
        client_id: finalClientId,
        compensation: optionalTrimmed(formData, "compensation"),
        payment_terms:
          typeof paymentTerms === "string" && paymentTerms ? paymentTerms : null,
        seniority_level:
          typeof seniorityLevel === "string" && seniorityLevel ? seniorityLevel : null,
        work_arrangement:
          typeof workArrangement === "string" && workArrangement ? workArrangement : null,
        priority: typeof priority === "string" && priority ? priority : null,
        target_fill_date:
          typeof targetFillDate === "string" && targetFillDate ? targetFillDate : null,
      })
      .select("id")
      .single();
    if (error || !newRole) throw error ?? new Error("Role creation returned no row");

    if (skillChips.length > 0) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from("profiles")
        .select("org_id")
        .eq("id", user?.id ?? "")
        .maybeSingle();
      if (profile) {
        const { persist } = finalizeSkillChips(skillChips);
        await persistRoleSkills(supabase, profile.org_id as string, newRole.id as string, persist);
      }
    }
  } catch (error) {
    if (error instanceof Error && error.message === "CLIENT_NOT_FOUND") {
      return { error: "That client couldn't be found." };
    }
    // Fail securely — never surface raw Postgres/schema errors (SECURITY.md).
    console.error("Failed to create role:", error);
    return { error: "Couldn't create the role. Please try again." };
  }

  revalidatePath(ROLES_PATH);
  return { error: null };
}

export async function updateRoleTitle(
  id: string,
  title: string
): Promise<RoleActionState> {
  if (!title.trim()) {
    return { error: "Title is required." };
  }

  try {
    const supabase = await requireUser();
    const { error } = await supabase
      .from("roles")
      .update({ title: title.trim() })
      .eq("id", id);
    if (error) throw error;
  } catch (error) {
    console.error("Failed to update role title:", error);
    return { error: "Couldn't save the title. Please try again." };
  }

  revalidatePath(ROLES_PATH);
  revalidatePath(rolePath(id));
  return { error: null };
}

export async function updateRoleJobDescription(
  id: string,
  jobDescription: string
): Promise<RoleActionState> {
  try {
    const supabase = await requireUser();
    const { error } = await supabase
      .from("roles")
      .update({ job_description: jobDescription.trim() || null })
      .eq("id", id);
    if (error) throw error;
  } catch (error) {
    console.error("Failed to update role job description:", error);
    return { error: "Couldn't save the job description. Please try again." };
  }

  revalidatePath(ROLES_PATH);
  revalidatePath(rolePath(id));
  return { error: null };
}

export async function updateRoleTimezoneOverlap(
  id: string,
  timezoneOverlap: string
): Promise<RoleActionState> {
  try {
    const supabase = await requireUser();
    const { error } = await supabase
      .from("roles")
      .update({ timezone_overlap: timezoneOverlap.trim() || null })
      .eq("id", id);
    if (error) throw error;
  } catch (error) {
    console.error("Failed to update role timezone overlap:", error);
    return { error: "Couldn't save the timezone overlap. Please try again." };
  }

  revalidatePath(ROLES_PATH);
  revalidatePath(rolePath(id));
  return { error: null };
}

export async function updateRoleClassification(
  id: string,
  classification: string | null
): Promise<RoleActionState> {
  if (
    classification !== null &&
    !ROLE_CLASSIFICATIONS.includes(classification as RoleClassification)
  ) {
    return { error: "Classification must be Embedded Operator or Project-Based." };
  }

  try {
    const supabase = await requireUser();
    const { error } = await supabase
      .from("roles")
      .update({ classification })
      .eq("id", id);
    if (error) throw error;
  } catch (error) {
    console.error("Failed to update role classification:", error);
    return { error: "Couldn't save the classification. Please try again." };
  }

  revalidatePath(ROLES_PATH);
  revalidatePath(rolePath(id));
  return { error: null };
}

export async function updateRoleStatus(
  id: string,
  status: string
): Promise<RoleActionState> {
  if (!ROLE_STATUSES.includes(status as RoleStatus)) {
    return { error: "Status must be open, filled, or closed." };
  }

  try {
    const supabase = await requireUser();
    const { error } = await supabase
      .from("roles")
      .update({ status })
      .eq("id", id);
    if (error) throw error;

    // Append-only status log, same pattern/non-fatal-on-failure handling
    // as candidates-actions.ts's updateCandidateStage → candidate_history
    // insert — the status change itself already succeeded, so a logging
    // failure here shouldn't fail the whole action.
    const { error: historyError } = await supabase
      .from("role_history")
      .insert({ role_id: id, label: `Status changed to ${status}` });
    if (historyError) {
      console.error("Failed to record role history:", historyError);
    }
  } catch (error) {
    console.error("Failed to update role status:", error);
    return { error: "Couldn't save the status. Please try again." };
  }

  revalidatePath(ROLES_PATH);
  revalidatePath(rolePath(id));
  return { error: null };
}

export async function updateRoleClientId(
  id: string,
  clientId: string | null
): Promise<RoleActionState> {
  try {
    const supabase = await requireUser();
    if (clientId) {
      await assertClientIsVisible(supabase, clientId);
    }
    const { error } = await supabase
      .from("roles")
      .update({ client_id: clientId })
      .eq("id", id);
    if (error) throw error;
  } catch (error) {
    if (error instanceof Error && error.message === "CLIENT_NOT_FOUND") {
      return { error: "That client couldn't be found." };
    }
    console.error("Failed to update role client:", error);
    return { error: "Couldn't save the client. Please try again." };
  }

  revalidatePath(ROLES_PATH);
  revalidatePath(rolePath(id));
  return { error: null };
}

export async function updateRoleCompensation(
  id: string,
  value: string
): Promise<RoleActionState> {
  try {
    const supabase = await requireUser();
    const { error } = await supabase
      .from("roles")
      .update({ compensation: value.trim() || null })
      .eq("id", id);
    if (error) throw error;
  } catch (error) {
    console.error("Failed to update role compensation:", error);
    return { error: "Couldn't save the compensation. Please try again." };
  }

  revalidatePath(ROLES_PATH);
  revalidatePath(rolePath(id));
  return { error: null };
}

export async function updateRolePaymentTerms(
  id: string,
  value: string | null
): Promise<RoleActionState> {
  if (value !== null && !PAYMENT_TERMS.includes(value as PaymentTerms)) {
    return { error: "Choose valid payment terms." };
  }

  try {
    const supabase = await requireUser();
    const { error } = await supabase
      .from("roles")
      .update({ payment_terms: value })
      .eq("id", id);
    if (error) throw error;
  } catch (error) {
    console.error("Failed to update role payment terms:", error);
    return { error: "Couldn't save the payment terms. Please try again." };
  }

  revalidatePath(ROLES_PATH);
  revalidatePath(rolePath(id));
  return { error: null };
}

export async function updateRoleSeniorityLevel(
  id: string,
  value: string | null
): Promise<RoleActionState> {
  if (value !== null && !SENIORITY_LEVELS.includes(value as SeniorityLevel)) {
    return { error: "Choose a valid seniority level." };
  }

  try {
    const supabase = await requireUser();
    const { error } = await supabase
      .from("roles")
      .update({ seniority_level: value })
      .eq("id", id);
    if (error) throw error;
  } catch (error) {
    console.error("Failed to update role seniority level:", error);
    return { error: "Couldn't save the seniority level. Please try again." };
  }

  revalidatePath(ROLES_PATH);
  revalidatePath(rolePath(id));
  return { error: null };
}

export async function updateRoleWorkArrangement(
  id: string,
  value: string | null
): Promise<RoleActionState> {
  if (value !== null && !WORK_ARRANGEMENTS.includes(value as WorkArrangement)) {
    return { error: "Choose a valid work arrangement." };
  }

  try {
    const supabase = await requireUser();
    const { error } = await supabase
      .from("roles")
      .update({ work_arrangement: value })
      .eq("id", id);
    if (error) throw error;
  } catch (error) {
    console.error("Failed to update role work arrangement:", error);
    return { error: "Couldn't save the work arrangement. Please try again." };
  }

  revalidatePath(ROLES_PATH);
  revalidatePath(rolePath(id));
  return { error: null };
}

export async function updateRolePriority(
  id: string,
  value: string | null
): Promise<RoleActionState> {
  if (value !== null && !ROLE_PRIORITIES.includes(value as RolePriority)) {
    return { error: "Choose a valid priority." };
  }

  try {
    const supabase = await requireUser();
    const { error } = await supabase
      .from("roles")
      .update({ priority: value })
      .eq("id", id);
    if (error) throw error;
  } catch (error) {
    console.error("Failed to update role priority:", error);
    return { error: "Couldn't save the priority. Please try again." };
  }

  revalidatePath(ROLES_PATH);
  revalidatePath(rolePath(id));
  return { error: null };
}

export async function updateRoleTargetFillDate(
  id: string,
  value: string | null
): Promise<RoleActionState> {
  try {
    const supabase = await requireUser();
    const { error } = await supabase
      .from("roles")
      .update({ target_fill_date: value || null })
      .eq("id", id);
    if (error) throw error;
  } catch (error) {
    console.error("Failed to update role target fill date:", error);
    return { error: "Couldn't save the target fill date. Please try again." };
  }

  revalidatePath(ROLES_PATH);
  revalidatePath(rolePath(id));
  return { error: null };
}

// ATS follow-up: "Parse JD" pre-fills skill chips from a job description
// already typed/pasted into the form — no role_id required, works
// identically for a brand-new role (create form) or an existing one
// (detail page), since it never writes anything, only reads the org's
// skill_aliases/match_skill lookups. Flagged for rate-limiting review,
// same convention as every other Anthropic-calling action in this app
// (draft-actions.ts/resume-parse-core.ts) — no existing per-org daily-
// count table to key a cap off of here either.
export async function parseRoleJobDescriptionSkills(
  jobDescription: string
): Promise<{ error: string | null; skills: SkillMatch[] }> {
  if (!jobDescription.trim()) {
    return { error: "Enter a job description first.", skills: [] };
  }

  try {
    const supabase = await requireUser();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data: profile } = await supabase
      .from("profiles")
      .select("org_id")
      .eq("id", user?.id ?? "")
      .maybeSingle();
    if (!profile) {
      throw new Error("Not authorized");
    }
    const skills = await parseJobDescriptionSkills(
      supabase,
      profile.org_id as string,
      jobDescription
    );
    return { error: null, skills };
  } catch (error) {
    // Fail securely — never forward a raw extraction/Anthropic error to
    // the client (SECURITY.md), same as resume-parse-actions.ts's
    // parseResume.
    console.error("Failed to parse job description:", error);
    return { error: "Couldn't parse this job description. Please try again.", skills: [] };
  }
}

async function assertRoleIsVisibleForSkills(
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

// The "save" half, for the role detail page's edit context —
// parseRoleJobDescriptionSkills above never writes anything, so an
// existing role's finalized chips need their own explicit persist call
// (unlike role creation, where createRole persists the staged chips
// together with the new row in one step).
export async function saveRoleSkills(
  roleId: string,
  chips: SubmittedSkillChip[]
): Promise<RoleActionState> {
  try {
    const supabase = await requireUser();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data: profile } = await supabase
      .from("profiles")
      .select("org_id")
      .eq("id", user?.id ?? "")
      .maybeSingle();
    if (!profile) {
      throw new Error("Not authorized");
    }
    // Authorization beyond RLS: re-verify this role is actually visible
    // to the caller's org before writing anything against it — same
    // pattern as every other action here that accepts an id from the
    // client rather than one it derived itself.
    await assertRoleIsVisibleForSkills(supabase, roleId);

    const { persist } = finalizeSkillChips(chips);
    await persistRoleSkills(supabase, profile.org_id as string, roleId, persist);
  } catch (error) {
    if (error instanceof Error && error.message === "ROLE_NOT_FOUND") {
      return { error: "That role couldn't be found." };
    }
    console.error("Failed to save role skills:", error);
    return { error: "Couldn't save skills. Please try again." };
  }

  revalidatePath(ROLES_PATH);
  revalidatePath(rolePath(roleId));
  return { error: null };
}

export async function deleteRole(id: string): Promise<RoleActionState> {
  try {
    const supabase = await requireUser();
    const { error } = await supabase.from("roles").delete().eq("id", id);
    if (error) {
      // Postgres foreign_key_violation — candidates still reference this role.
      if (error.code === "23503") {
        return {
          error:
            "This role has candidates assigned to it. Move or remove them before deleting.",
        };
      }
      throw error;
    }
  } catch (error) {
    console.error("Failed to delete role:", error);
    return { error: "Couldn't delete the role. Please try again." };
  }

  revalidatePath(ROLES_PATH);
  return { error: null };
}
