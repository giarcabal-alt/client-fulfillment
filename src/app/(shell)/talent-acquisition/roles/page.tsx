import Link from "next/link";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { RolesList } from "./roles-list";

export default async function RolesPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("roles")
    .select(
      "id, title, job_description, status, timezone_overlap, classification, candidates(count)"
    )
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to load roles:", error);
  }

  const roles = (data ?? []).map((role) => ({
    id: role.id as string,
    title: role.title as string,
    job_description: role.job_description as string | null,
    status: role.status as "open" | "filled" | "closed",
    timezone_overlap: role.timezone_overlap as string | null,
    classification: role.classification as
      | "embedded_operator"
      | "project_based"
      | null,
    candidateCount: (role.candidates as { count: number }[] | null)?.[0]
      ?.count ?? 0,
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

      {!error && <RolesList roles={roles} />}
    </div>
  );
}
