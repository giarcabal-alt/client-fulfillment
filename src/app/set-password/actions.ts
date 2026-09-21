"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type SetPasswordState = { error: string | null };

export async function setPassword(
  _prevState: SetPasswordState,
  formData: FormData
): Promise<SetPasswordState> {
  const password = formData.get("password");
  const confirmPassword = formData.get("confirmPassword");

  if (typeof password !== "string" || typeof confirmPassword !== "string") {
    return { error: "Password is required." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  if (password !== confirmPassword) {
    return { error: "Passwords don't match." };
  }

  const supabase = await createClient();

  // Requires an existing session — only reachable after /auth/confirm has
  // already verified an invite token and established one (SECURITY.md:
  // getUser() re-derives and revalidates it, never trusts a client-passed
  // id). A signed-in user with no active session-establishing token gets
  // rejected by Supabase itself, not just by this page's own redirect.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    console.error("Failed to set password:", error.message);
    return { error: "Couldn't set your password. Please try again." };
  }

  redirect("/talent-acquisition/board");
}
