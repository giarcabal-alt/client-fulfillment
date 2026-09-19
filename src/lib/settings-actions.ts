"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type SettingsActionState = { error: string | null };

const SETTINGS_PATH = "/settings";

// Every action re-derives the user server-side via getUser() (never
// getSession(), never a client-passed id) per SECURITY.md. These are plain
// DB reads/writes with no external side effect, so RLS's org/own-row
// scoping is the authorization boundary.
async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Not authenticated");
  }
  return { supabase, user };
}

// Org-level — org_settings' RLS policy scopes this to the caller's own org,
// same as every other org_settings read/write in this app.
export async function updateCompanyName(
  companyName: string
): Promise<SettingsActionState> {
  try {
    const { supabase } = await requireUser();
    const { error } = await supabase
      .from("org_settings")
      .update({ company_name: companyName.trim() || null })
      .eq("org_id", "00000000-0000-0000-0000-000000000001");
    if (error) throw error;
  } catch (error) {
    console.error("Failed to update company name:", error);
    return { error: "Couldn't save the company name. Please try again." };
  }

  revalidatePath(SETTINGS_PATH);
  return { error: null };
}

// Per-user — profiles' "update own row" RLS policy means this can only
// ever touch the caller's own row, regardless of what id is passed.
export async function updateDisplayName(
  displayName: string
): Promise<SettingsActionState> {
  try {
    const { supabase, user } = await requireUser();
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayName.trim() || null })
      .eq("id", user.id);
    if (error) throw error;
  } catch (error) {
    console.error("Failed to update display name:", error);
    return { error: "Couldn't save your display name. Please try again." };
  }

  revalidatePath(SETTINGS_PATH);
  return { error: null };
}
