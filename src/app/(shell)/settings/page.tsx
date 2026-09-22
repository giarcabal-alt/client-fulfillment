import { Section, SectionDivider } from "@/components/ui/section";
import { createClient } from "@/lib/supabase/server";
import { CompanyNameField, DisplayNameField } from "./settings-form";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: settingsRow, error: settingsError }, { data: profileRow, error: profileError }] =
    await Promise.all([
      supabase.from("org_settings").select("company_name").maybeSingle(),
      user
        ? supabase
            .from("profiles")
            .select("display_name")
            .eq("id", user.id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

  if (settingsError) {
    console.error("Failed to load org settings:", settingsError);
  }
  if (profileError) {
    console.error("Failed to load profile:", profileError);
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-3 p-4 sm:p-6">
      <div>
        <h1 className="font-display text-xl text-ink-navy">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Company details and your own profile.
        </p>
      </div>

      {(settingsError || profileError) && (
        <p className="text-sm text-destructive">
          Couldn&apos;t load some settings. Please refresh the page.
        </p>
      )}

      <Section>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-ink-navy">Company</span>
          <CompanyNameField
            companyName={(settingsRow?.company_name as string | null) ?? null}
          />
        </div>

        <SectionDivider className="my-3" />

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-ink-navy">
            Your profile
          </span>
          {user?.email && (
            <p className="text-xs text-muted-foreground">
              Signed in as {user.email}
            </p>
          )}
          <DisplayNameField
            displayName={(profileRow?.display_name as string | null) ?? null}
          />
        </div>
      </Section>
    </div>
  );
}
