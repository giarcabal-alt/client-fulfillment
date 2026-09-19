import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-4 sm:p-8">
      <div>
        <h1 className="text-2xl">Settings</h1>
        <p className="mt-1 text-muted-foreground">
          Company details and your own profile.
        </p>
      </div>

      {(settingsError || profileError) && (
        <p className="text-sm text-destructive">
          Couldn&apos;t load some settings. Please refresh the page.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Company</CardTitle>
        </CardHeader>
        <CardContent>
          <CompanyNameField
            companyName={
              (settingsRow?.company_name as string | null) ?? null
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Your profile</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {user?.email && (
            <p className="text-sm text-muted-foreground">
              Signed in as {user.email}
            </p>
          )}
          <DisplayNameField
            displayName={
              (profileRow?.display_name as string | null) ?? null
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
