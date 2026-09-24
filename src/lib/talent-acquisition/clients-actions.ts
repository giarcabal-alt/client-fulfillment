"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ClientActionState = { error: string | null };

const CLIENTS_PATH = "/talent-acquisition/clients";
const clientPath = (id: string) => `/talent-acquisition/clients/${id}`;

// Same requireUser() shape as roles-actions.ts/candidates-actions.ts —
// plain DB reads/writes with no external side effect, so RLS's org
// scoping is the authorization boundary, no additional check needed.
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

export async function createClientRecord(
  _prevState: ClientActionState,
  formData: FormData
): Promise<ClientActionState> {
  const companyName = formData.get("company_name");
  if (typeof companyName !== "string" || !companyName.trim()) {
    return { error: "Company name is required." };
  }

  const optional = (key: string) => {
    const value = formData.get(key);
    return typeof value === "string" && value.trim() ? value.trim() : null;
  };

  try {
    const supabase = await requireUser();
    const { error } = await supabase.from("clients").insert({
      company_name: companyName.trim(),
      industry: optional("industry"),
      website: optional("website"),
      location: optional("location"),
      timezone: optional("timezone"),
      point_of_contact_name: optional("point_of_contact_name"),
      point_of_contact_email: optional("point_of_contact_email"),
      point_of_contact_phone: optional("point_of_contact_phone"),
      notes: optional("notes"),
    });
    if (error) throw error;
  } catch (error) {
    console.error("Failed to create client:", error);
    return { error: "Couldn't create the client. Please try again." };
  }

  revalidatePath(CLIENTS_PATH);
  return { error: null };
}

// One update action per field, each its own plain top-level async
// function — same save-on-blur shape as roles-actions.ts/
// candidates-actions.ts's per-field actions. Deliberately NOT built via a
// shared factory (`makeFieldUpdater(column)`) despite the duplication:
// a "use server" file's compile-time transform needs each exported
// server action to be a statically-recognizable async function
// declaration (PROJECT_STATE.md §10 — this exact file type already has
// one documented gotcha about non-function exports silently vanishing
// from the client bundle); a factory-returned closure assigned to an
// export risks the same class of silent-breakage the compiler can't
// necessarily see through, and this is the first time this codebase
// would try it. Not worth being the first file to find out the hard way.
async function updateClientField(
  id: string,
  column: string,
  value: string | null
): Promise<ClientActionState> {
  try {
    const supabase = await requireUser();
    const { error } = await supabase
      .from("clients")
      .update({ [column]: value?.trim() || null })
      .eq("id", id);
    if (error) throw error;
  } catch (error) {
    console.error(`Failed to update client ${column}:`, error);
    return { error: "Couldn't save. Please try again." };
  }

  revalidatePath(CLIENTS_PATH);
  revalidatePath(clientPath(id));
  return { error: null };
}

export async function updateClientCompanyName(
  id: string,
  value: string
): Promise<ClientActionState> {
  if (!value.trim()) {
    return { error: "Company name is required." };
  }
  return updateClientField(id, "company_name", value);
}

export async function updateClientIndustry(
  id: string,
  value: string | null
): Promise<ClientActionState> {
  return updateClientField(id, "industry", value);
}

export async function updateClientWebsite(
  id: string,
  value: string | null
): Promise<ClientActionState> {
  return updateClientField(id, "website", value);
}

export async function updateClientLocation(
  id: string,
  value: string | null
): Promise<ClientActionState> {
  return updateClientField(id, "location", value);
}

export async function updateClientTimezone(
  id: string,
  value: string | null
): Promise<ClientActionState> {
  return updateClientField(id, "timezone", value);
}

export async function updateClientPointOfContactName(
  id: string,
  value: string | null
): Promise<ClientActionState> {
  return updateClientField(id, "point_of_contact_name", value);
}

export async function updateClientPointOfContactEmail(
  id: string,
  value: string | null
): Promise<ClientActionState> {
  return updateClientField(id, "point_of_contact_email", value);
}

export async function updateClientPointOfContactPhone(
  id: string,
  value: string | null
): Promise<ClientActionState> {
  return updateClientField(id, "point_of_contact_phone", value);
}

export async function updateClientNotes(
  id: string,
  value: string | null
): Promise<ClientActionState> {
  return updateClientField(id, "notes", value);
}
