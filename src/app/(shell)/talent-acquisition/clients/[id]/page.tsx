import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Section, SectionDivider } from "@/components/ui/section";
import { createClient } from "@/lib/supabase/server";
import { ClientDetailForm, type ClientDetail } from "./client-detail-form";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: clientRow, error }, { data: rolesData }] = await Promise.all([
    supabase
      .from("clients")
      .select(
        "id, company_name, industry, website, location, timezone, point_of_contact_name, point_of_contact_email, point_of_contact_phone, notes"
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("roles")
      .select("id, title, status")
      .eq("client_id", id)
      .order("title"),
  ]);

  if (error || !clientRow) {
    notFound();
  }

  const client: ClientDetail = {
    id: clientRow.id as string,
    company_name: clientRow.company_name as string,
    industry: clientRow.industry as string | null,
    website: clientRow.website as string | null,
    location: clientRow.location as string | null,
    timezone: clientRow.timezone as string | null,
    point_of_contact_name: clientRow.point_of_contact_name as string | null,
    point_of_contact_email: clientRow.point_of_contact_email as string | null,
    point_of_contact_phone: clientRow.point_of_contact_phone as string | null,
    notes: clientRow.notes as string | null,
  };

  const roles = (rolesData ?? []).map((r) => ({
    id: r.id as string,
    title: r.title as string,
    status: r.status as string,
  }));

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-3 p-4 sm:p-6">
      <Button
        variant="outline"
        size="sm"
        className="w-fit"
        nativeButton={false}
        render={<Link href="/talent-acquisition/clients">← Back to Clients</Link>}
      />

      <Section>
        <ClientDetailForm client={client} />
      </Section>

      <Section title="Roles" bodyClassName="px-0" className="gap-0 py-0">
        {roles.length === 0 ? (
          <p className="px-4 py-3 text-sm text-muted-foreground">
            No roles linked to this client yet.
          </p>
        ) : (
          roles.map((role, i) => (
            <div key={role.id}>
              {i > 0 && <SectionDivider />}
              <Link
                href={`/talent-acquisition/roles/${role.id}`}
                className="flex items-center justify-between gap-3 px-4 py-2 text-sm hover:bg-stone/30"
              >
                <span className="text-ink-navy">{role.title}</span>
                <span className="text-xs text-muted-foreground">{role.status}</span>
              </Link>
            </div>
          ))
        )}
      </Section>
    </div>
  );
}
