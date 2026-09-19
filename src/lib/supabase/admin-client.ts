import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// The one place in this codebase that intentionally bypasses RLS — the
// service-role key has full read/write on every table regardless of
// policy, and `auth.admin.*` methods (listUsers, inviteUserByEmail) are
// only available on a service-role client, never the anon-key one.
//
// Never import this from a Client Component. SUPABASE_SERVICE_ROLE_KEY has
// no NEXT_PUBLIC_ prefix, so bundling it client-side would fail at build
// time — but this file stays server-only by convention too, so that's a
// backstop, not the actual guarantee. The actual guarantee is every call
// site's own explicit `requireAdmin()` check (SECURITY.md's
// authorization-beyond-RLS rule): this client has no authorization
// built in, it will happily do anything asked of it, so gating who's
// allowed to ask is entirely on the caller.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
