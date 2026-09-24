import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getUserRole } from "@/lib/auth/get-user-role";
import { createClient } from "@/lib/supabase/server";
import { ClientsList } from "./clients-list";

export default async function ClientsPage() {
  const supabase = await createClient();
  const [{ data, error }, { data: rolesData }, role] = await Promise.all([
    supabase
      .from("clients")
      .select(
        "id, company_name, industry, website, location, timezone, point_of_contact_name, point_of_contact_email, point_of_contact_phone, notes"
      )
      .order("company_name"),
    // Every role's client_id + title, fetched once and grouped
    // client-side — same shape as the old per-client detail page's own
    // roles query, just done for every client in one round trip instead
    // of one query per client now that they all render on one page.
    supabase.from("roles").select("id, title, client_id").order("title"),
    getUserRole(),
  ]);

  if (error) {
    console.error("Failed to load clients:", error);
  }

  const rolesByClient = new Map<string, { id: string; title: string }[]>();
  for (const r of rolesData ?? []) {
    const clientId = r.client_id as string | null;
    if (!clientId) continue;
    const list = rolesByClient.get(clientId) ?? [];
    list.push({ id: r.id as string, title: r.title as string });
    rolesByClient.set(clientId, list);
  }

  const clients = (data ?? []).map((client) => ({
    id: client.id as string,
    company_name: client.company_name as string,
    industry: client.industry as string | null,
    website: client.website as string | null,
    location: client.location as string | null,
    timezone: client.timezone as string | null,
    point_of_contact_name: client.point_of_contact_name as string | null,
    point_of_contact_email: client.point_of_contact_email as string | null,
    point_of_contact_phone: client.point_of_contact_phone as string | null,
    notes: client.notes as string | null,
    roles: rolesByClient.get(client.id as string) ?? [],
  }));

  return (
    <div className="flex w-full flex-col gap-3 p-4 sm:p-6">
      <div className="min-w-0">
        <Button
          variant="outline"
          size="sm"
          className="mb-2"
          nativeButton={false}
          render={<Link href="/talent-acquisition/board">← Back to board</Link>}
        />
        <h1 className="font-display text-xl text-ink-navy">Clients</h1>
        <p className="text-sm text-muted-foreground">
          The companies whose open roles this org is sourcing for.
        </p>
      </div>

      {error && (
        <p className="text-sm text-destructive">
          Couldn&apos;t load clients. Please refresh the page.
        </p>
      )}

      {!error && <ClientsList clients={clients} isAdmin={role === "admin"} />}
    </div>
  );
}
