"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type RoleActionState = { error: string | null };

const ROLE_STATUSES = ["open", "filled", "closed"] as const;
type RoleStatus = (typeof ROLE_STATUSES)[number];

const ROLES_PATH = "/talent-acquisition/roles";

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

export async function createRole(
  _prevState: RoleActionState,
  formData: FormData
): Promise<RoleActionState> {
  const title = formData.get("title");
  const jobDescription = formData.get("job_description");

  if (typeof title !== "string" || !title.trim()) {
    return { error: "Title is required." };
  }

  try {
    const supabase = await requireUser();
    const { error } = await supabase.from("roles").insert({
      title: title.trim(),
      job_description:
        typeof jobDescription === "string" && jobDescription.trim()
          ? jobDescription.trim()
          : null,
    });
    if (error) throw error;
  } catch (error) {
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
  } catch (error) {
    console.error("Failed to update role status:", error);
    return { error: "Couldn't save the status. Please try again." };
  }

  revalidatePath(ROLES_PATH);
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
