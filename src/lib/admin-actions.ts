"use server";

import { revalidatePath } from "next/cache";
import { requireAdminUser } from "@/lib/auth/get-user-role";
import { createAdminClient } from "@/lib/supabase/admin-client";

export type AdminActionState = { error: string | null };

const ADMIN_PATH = "/admin";
const ROLES = ["admin", "member"] as const;
type Role = (typeof ROLES)[number];

// Every action here calls requireAdminUser() first — never trusts that the
// caller only reached this action through the (already role-gated) admin
// page's UI. Server Actions are independently reachable network endpoints
// (SECURITY.md); the admin page hiding its link and 404-ing non-admins who
// navigate there directly is not itself an authorization boundary — these
// actions are.
//
// All writes here use the admin (service-role) client, not the normal
// RLS-scoped one: RLS's "profiles: update own row" policy only ever lets a
// caller update their *own* profiles row, so an admin changing someone
// else's role or display name has no RLS policy that would allow it
// through the normal client. See src/lib/supabase/admin-client.ts.
//
// ⚠️ inviteUser sends an external email via Supabase Auth — flagged for
// rate-limiting review per SECURITY.md's rule for any action with an
// external side effect; no rate limit is implemented yet.

function authErrorMessage(error: unknown): string | null {
  if (
    error instanceof Error &&
    (error.message === "Not authenticated" || error.message === "Not authorized")
  ) {
    return "Not authorized.";
  }
  return null;
}

export async function inviteUser(
  _prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const email = formData.get("email");
  if (typeof email !== "string" || !email.trim()) {
    return { error: "Email is required." };
  }

  try {
    await requireAdminUser();
    const admin = createAdminClient();
    // inviteUserByEmail (not a signup + admin-set password) so the new
    // user sets their own password via the emailed link — the admin
    // never sets or sees another user's password.
    const { error } = await admin.auth.admin.inviteUserByEmail(email.trim());
    if (error) throw error;
  } catch (error) {
    const authMessage = authErrorMessage(error);
    if (authMessage) return { error: authMessage };
    console.error("Failed to invite user:", error);
    return { error: "Couldn't send the invite. Please try again." };
  }

  revalidatePath(ADMIN_PATH);
  return { error: null };
}

export async function updateUserRole(
  userId: string,
  role: string
): Promise<AdminActionState> {
  if (!ROLES.includes(role as Role)) {
    return { error: "Role must be admin or member." };
  }

  try {
    const actingUser = await requireAdminUser();

    if (role === "member") {
      if (userId === actingUser.id) {
        return { error: "You can't demote yourself." };
      }

      const admin = createAdminClient();
      const { data: target, error: targetError } = await admin
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .maybeSingle();
      if (targetError || !target) {
        throw targetError ?? new Error("User not found");
      }

      // Only the last-remaining-admin case needs blocking — demoting one
      // of several admins is fine.
      if (target.role === "admin") {
        const { count, error: countError } = await admin
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("role", "admin");
        if (countError) throw countError;
        if ((count ?? 0) <= 1) {
          return { error: "Can't demote the last remaining admin." };
        }
      }
    }

    const admin = createAdminClient();
    const { error } = await admin
      .from("profiles")
      .update({ role })
      .eq("id", userId);
    if (error) throw error;
  } catch (error) {
    const authMessage = authErrorMessage(error);
    if (authMessage) return { error: authMessage };
    console.error("Failed to update user role:", error);
    return { error: "Couldn't update the role. Please try again." };
  }

  revalidatePath(ADMIN_PATH);
  return { error: null };
}

export async function updateUserDisplayName(
  userId: string,
  displayName: string
): Promise<AdminActionState> {
  try {
    await requireAdminUser();
    const admin = createAdminClient();
    const { error } = await admin
      .from("profiles")
      .update({ display_name: displayName.trim() || null })
      .eq("id", userId);
    if (error) throw error;
  } catch (error) {
    const authMessage = authErrorMessage(error);
    if (authMessage) return { error: authMessage };
    console.error("Failed to update display name:", error);
    return { error: "Couldn't save the display name. Please try again." };
  }

  revalidatePath(ADMIN_PATH);
  return { error: null };
}
