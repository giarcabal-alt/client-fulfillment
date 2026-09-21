import { type EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Receives the link from Supabase's invite/magiclink/recovery emails — the
// Auth email templates (Supabase dashboard → Authentication → Email
// Templates) must point here with `token_hash`/`type` query params
// (Supabase's documented server-side-verification pattern), not use
// Supabase's own default confirmation link. That default form redirects
// with the session in a URL hash fragment (`#access_token=...`), which a
// server-side route handler never sees — the fragment is stripped before
// the request leaves the browser. This is a manual dashboard step outside
// this codebase's reach; verified against the real templates once
// updated, but nothing here can set or check that configuration itself.
// verifyOtp() both validates the token and establishes a real session via
// the cookie-writing server client, so whatever `next` points to loads
// already authenticated.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/";

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (!error) {
      redirect(next);
    }
    console.error("Failed to verify auth token:", error.message);
  }

  // A genuinely expired/invalid/already-used link (or a missing/malformed
  // token_hash) lands here — a real page explaining that, not a silent
  // redirect to /login that looks identical to "nothing happened."
  redirect("/auth/error");
}
