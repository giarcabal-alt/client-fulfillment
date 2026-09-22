import { notFound } from "next/navigation";
import { Section, SectionDivider } from "@/components/ui/section";
import { getUserRole } from "@/lib/auth/get-user-role";
import { createAdminClient } from "@/lib/supabase/admin-client";
import { InviteUserForm } from "./invite-user-form";
import { UserRow } from "./user-row";

export default async function AdminPage() {
  // Explicit, page-level authorization check — not just a hidden sidebar
  // link. A non-admin navigating here directly gets a 404, not a redirect
  // that would confirm the route exists at all. getUserRole() re-derives
  // the user server-side via getUser() itself (SECURITY.md).
  const role = await getUserRole();
  if (role !== "admin") {
    notFound();
  }

  // Service-role client: profiles has no email column, so listing users
  // needs supabase.auth.admin.listUsers(), which only works with the
  // service-role key. See src/lib/supabase/admin-client.ts.
  const admin = createAdminClient();

  const [{ data: authData, error: authError }, { data: profiles, error: profilesError }] =
    await Promise.all([
      admin.auth.admin.listUsers(),
      admin.from("profiles").select("id, display_name, role"),
    ]);

  if (authError) {
    console.error("Failed to list users:", authError);
  }
  if (profilesError) {
    console.error("Failed to load profiles:", profilesError);
  }

  const profileById = new Map(
    (profiles ?? []).map((p) => [
      p.id as string,
      {
        displayName: p.display_name as string | null,
        role: (p.role as "admin" | "member" | null) ?? "member",
      },
    ])
  );

  const users = (authData?.users ?? [])
    .map((u) => {
      const profile = profileById.get(u.id);
      return {
        id: u.id,
        email: u.email ?? "(no email)",
        displayName: profile?.displayName ?? null,
        role: profile?.role ?? "member",
      };
    })
    .sort((a, b) => a.email.localeCompare(b.email));

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-3 p-4 sm:p-6">
      <div>
        <h1 className="font-display text-xl text-ink-navy">Admin</h1>
        <p className="text-sm text-muted-foreground">
          Manage teammates and their access.
        </p>
      </div>

      {(authError || profilesError) && (
        <p className="text-sm text-destructive">
          Couldn&apos;t load the full user list. Please refresh the page.
        </p>
      )}

      <Section>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-ink-navy">
            Invite a teammate
          </span>
          <InviteUserForm />
        </div>

        <SectionDivider className="my-3" />

        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-ink-navy">
            Teammates
          </span>
          {users.length === 0 ? (
            <p className="text-sm text-muted-foreground">No users yet.</p>
          ) : (
            <div className="-mx-4 flex flex-col">
              {users.map((u, i) => (
                <div key={u.id}>
                  {i > 0 && <SectionDivider />}
                  <UserRow user={u} />
                </div>
              ))}
            </div>
          )}
        </div>
      </Section>
    </div>
  );
}
