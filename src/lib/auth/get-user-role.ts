import { createClient } from "@/lib/supabase/server";

export type UserRole = "admin" | "member";

// Returns the current user's role from their own `profiles` row, or null
// if there's no authenticated user (or, defensively, no matching profile
// row). Always re-derives the user server-side via getUser() — never
// getSession(), never a client-passed id — per SECURITY.md.
//
// RLS ("profiles: select own org") only enforces org membership, not
// role — it does not stop a signed-in member from calling an admin-only
// Server Action. Any future admin-only action MUST call this (or
// requireAdmin below) and check the result explicitly, inside the action
// itself, not only gate the UI that links to it. This is the
// authorization-beyond-RLS check SECURITY.md requires for anything with a
// side effect, extended here to role, not just org.
export async function getUserRole(): Promise<UserRole | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !data) return null;
  return data.role as UserRole;
}

// Convenience wrapper for the common case: throw unless the caller is an
// admin. Matches this codebase's existing fail-securely convention (each
// *-actions.ts file's own requireUser() throws, caught by the calling
// action's try/catch, which returns a generic error — never a raw
// Postgres/auth error — to the client).
export async function requireAdmin(): Promise<void> {
  const role = await getUserRole();
  if (role !== "admin") {
    throw new Error("Not authorized");
  }
}

// Same check as requireAdmin(), but also returns the acting user — for
// admin actions that need to compare the caller's own id against a target
// id (e.g. blocking an admin from demoting themselves in
// src/lib/admin-actions.ts). Re-derives the user itself rather than
// accepting one as a parameter, per SECURITY.md: never trust a
// client-passed id for an authorization decision.
export async function requireAdminUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Not authenticated");
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !data || data.role !== "admin") {
    throw new Error("Not authorized");
  }

  return user;
}
