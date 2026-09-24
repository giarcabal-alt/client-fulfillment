import Link from "next/link";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { RolesList } from "./roles-list";

export default async function RolesPage() {
  const supabase = await createClient();
  const [{ data, error }, { data: clientsData }] = await Promise.all([
    supabase
      .from("roles")
      .select(
        "id, title, job_description, status, timezone_overlap, classification, priority, target_fill_date, client:clients(id, company_name), candidates(count)"
      )
      .order("created_at", { ascending: false }),
    supabase.from("clients").select("id, company_name").order("company_name"),
  ]);

  if (error) {
    console.error("Failed to load roles:", error);
  }

  type ClientEmbed = { id: string; company_name: string } | { id: string; company_name: string }[] | null;

  const roles = (data ?? []).map((role) => {
    const clientEmbed = role.client as ClientEmbed;
    const client = Array.isArray(clientEmbed) ? clientEmbed[0] ?? null : clientEmbed;
    return {
      id: role.id as string,
      title: role.title as string,
      job_description: role.job_description as string | null,
      status: role.status as "open" | "filled" | "closed",
      timezone_overlap: role.timezone_overlap as string | null,
      classification: role.classification as
        | "embedded_operator"
        | "project_based"
        | null,
      priority: role.priority as "standard" | "urgent" | "on_hold" | null,
      target_fill_date: role.target_fill_date as string | null,
      clientName: client?.company_name ?? null,
      candidateCount: (role.candidates as { count: number }[] | null)?.[0]
        ?.count ?? 0,
    };
  });

  const clients = (clientsData ?? []).map((c) => ({
    id: c.id as string,
    company_name: c.company_name as string,
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
        <h1 className="font-display text-xl text-ink-navy">Job Openings</h1>
        <p className="text-sm text-muted-foreground">
          Open requisitions candidates can be assigned to.
        </p>
      </div>

      {error && (
        <p className="text-sm text-destructive">
          Couldn&apos;t load roles. Please refresh the page.
        </p>
      )}

      {!error && <RolesList roles={roles} clients={clients} />}
    </div>
  );
}
