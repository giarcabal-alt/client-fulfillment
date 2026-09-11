import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Service-role client — bypasses RLS. Never import this from a Client Component;
// SUPABASE_SERVICE_ROLE_KEY has no NEXT_PUBLIC_ prefix so bundling it client-side
// would fail at build time, but keep this file server-only by convention too.
// Every call site is still responsible for its own authorization check (SECURITY.md).
export function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
