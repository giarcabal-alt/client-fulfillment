"use server";

import { revalidatePath } from "next/cache";
import { requireAdminUser } from "@/lib/auth/get-user-role";
import { createAdminClient } from "@/lib/supabase/admin-client";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

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
// ⚠️ inviteUser and resetUserPassword both send an external email via
// Supabase Auth — flagged for rate-limiting review per SECURITY.md's rule
// for any action with an external side effect; no rate limit is
// implemented yet.

function authErrorMessage(error: unknown): string | null {
  if (
    error instanceof Error &&
    (error.message === "Not authenticated" || error.message === "Not authorized")
  ) {
    return "Not authorized.";
  }
  return null;
}

// Shared by updateUserRole's demote-to-member path and deleteUser — both
// need to block the exact same case (removing the last admin's admin
// status, one way or the other) with the same check.
async function isLastRemainingAdmin(
  admin: SupabaseClient,
  currentRole: string
): Promise<boolean> {
  if (currentRole !== "admin") return false;
  const { count, error } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin");
  if (error) throw error;
  return (count ?? 0) <= 1;
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
    // never sets or sees another user's password. redirectTo must point
    // at /auth/confirm (the route that verifies the invite token and
    // establishes a session) rather than Supabase's default confirmation
    // URL — the Auth email template must also link to this same
    // token_hash/type/redirect_to shape for the link to land here at all
    // (see set-password build notes in docs/PROJECT_STATE.md).
    const { error } = await admin.auth.admin.inviteUserByEmail(email.trim(), {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/confirm?next=/set-password`,
    });
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
      if (await isLastRemainingAdmin(admin, target.role)) {
        return { error: "Can't demote the last remaining admin." };
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

// resetPasswordForEmail is a regular (non-admin) auth method — it's the
// same public "forgot password" endpoint anyone can call for their own
// email, just triggered here on someone else's behalf. Uses the normal
// cookie-scoped client, not admin-client.ts: this doesn't need
// service-role privileges, and PROJECT_STATE.md's own guidance is to
// reach for the RLS-bypassing client only when a normal one genuinely
// can't do the job.
export async function resetUserPassword(
  email: string
): Promise<AdminActionState> {
  try {
    await requireAdminUser();
    const supabase = await createClient();
    // redirectTo matches inviteUser's — same /auth/confirm verification
    // route handles both an invite token and a recovery token, since
    // both are just EmailOtpType variants of the same verifyOtp() call.
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/confirm?next=/set-password`,
    });
    if (error) throw error;
  } catch (error) {
    const authMessage = authErrorMessage(error);
    if (authMessage) return { error: authMessage };
    console.error("Failed to send password reset:", error);
    return { error: "Couldn't send the password reset email. Please try again." };
  }

  return { error: null };
}

export async function deleteUser(userId: string): Promise<AdminActionState> {
  try {
    const actingUser = await requireAdminUser();

    if (userId === actingUser.id) {
      return { error: "You can't delete yourself." };
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

    if (await isLastRemainingAdmin(admin, target.role)) {
      return { error: "Can't delete the last remaining admin." };
    }

    // A live, current responsibility — never silently cleared. Reassign
    // is a deliberate human decision, not a side effect of deleting the
    // assignee's account. (Historical attribution columns like
    // created_by/generated_by are a different case: those are set null
    // on delete at the database level, not blocked — see the migration
    // that added that behavior.)
    const { count: assignedCount, error: assignedError } = await admin
      .from("candidates")
      .select("id", { count: "exact", head: true })
      .eq("assigned_to", userId);
    if (assignedError) throw assignedError;
    if ((assignedCount ?? 0) > 0) {
      const n = assignedCount ?? 0;
      return {
        error: `This user has ${n} candidate${n === 1 ? "" : "s"} assigned to them. Reassign ${n === 1 ? "it" : "them"} first, then delete this user.`,
      };
    }

    // Delete the profiles row before the auth user — profiles.id
    // references auth.users(id), and deleting the parent row first would
    // fail with a foreign-key violation while a child row still exists.
    // This is defense in depth: the migration adding `on delete cascade`
    // to that FK makes this step redundant once applied, but this action
    // doesn't assume that migration has run.
    const { error: profileDeleteError } = await admin
      .from("profiles")
      .delete()
      .eq("id", userId);
    if (profileDeleteError) throw profileDeleteError;

    const { error: authDeleteError } = await admin.auth.admin.deleteUser(userId);
    if (authDeleteError) throw authDeleteError;
  } catch (error) {
    const authMessage = authErrorMessage(error);
    if (authMessage) return { error: authMessage };
    // Postgres 23503 = foreign_key_violation — surfaces if this user has
    // created roles/candidates/history/drafts and the FK-behavior
    // migration (20260921090000) hasn't been applied yet, since those
    // columns still default to blocking instead of setting null.
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "23503"
    ) {
      console.error("Failed to delete user (FK violation):", error);
      return {
        error:
          "Couldn't delete this user — they're referenced by other records (roles, candidates, or history) and the database migration enabling safe deletion hasn't been applied yet.",
      };
    }
    console.error("Failed to delete user:", error);
    return { error: "Couldn't delete the user. Please try again." };
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
