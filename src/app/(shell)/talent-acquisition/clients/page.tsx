import Link from "next/link";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { ClientsList } from "./clients-list";

export default async function ClientsPage() {
  const supabase = await createClient();
  const [{ data, error }, { data: roleCountsData }] = await Promise.all([
    supabase
      .from("clients")
      .select("id, company_name, point_of_contact_name, timezone")
      .order("company_name"),
    // No aggregate "roles per client" query available without a second
    // round trip through PostgREST's embed-count syntax per client id —
    // simpler and just as cheap at this app's scale to fetch every role's
    // client_id once and count client-side, same shape as roles/page.tsx's
    // own candidates(count) embed does per-role.
    supabase.from("roles").select("client_id"),
  ]);

  if (error) {
    console.error("Failed to load clients:", error);
  }

  const roleCountByClient = new Map<string, number>();
  for (const row of roleCountsData ?? []) {
    const clientId = row.client_id as string | null;
    if (!clientId) continue;
    roleCountByClient.set(clientId, (roleCountByClient.get(clientId) ?? 0) + 1);
  }

  const clients = (data ?? []).map((client) => ({
    id: client.id as string,
    company_name: client.company_name as string,
    point_of_contact_name: client.point_of_contact_name as string | null,
    timezone: client.timezone as string | null,
    roleCount: roleCountByClient.get(client.id as string) ?? 0,
  }));

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-3 p-4 sm:p-6">
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

      {!error && <ClientsList clients={clients} />}
    </div>
  );
}
