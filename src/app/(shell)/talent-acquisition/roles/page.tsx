import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { NewRoleForm } from "./new-role-form";
import { RoleRow } from "./role-row";

export default async function RolesPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("roles")
    .select("id, title, job_description, status, candidates(count)")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to load roles:", error);
  }

  const roles = (data ?? []).map((role) => ({
    id: role.id as string,
    title: role.title as string,
    job_description: role.job_description as string | null,
    status: role.status as "open" | "filled" | "closed",
    candidateCount: (role.candidates as { count: number }[] | null)?.[0]
      ?.count ?? 0,
  }));

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-4 sm:p-8">
      <div>
        <h1 className="text-2xl">Roles</h1>
        <p className="mt-1 text-muted-foreground">
          Open requisitions candidates can be assigned to.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Add a role</CardTitle>
        </CardHeader>
        <CardContent>
          <NewRoleForm />
        </CardContent>
      </Card>

      {error && (
        <p className="text-sm text-destructive">
          Couldn&apos;t load roles. Please refresh the page.
        </p>
      )}

      {!error && roles.length === 0 && (
        <p className="text-muted-foreground">
          No roles yet — add one above to get started.
        </p>
      )}

      <div className="flex flex-col gap-4">
        {roles.map((role) => (
          <RoleRow key={role.id} role={role} />
        ))}
      </div>
    </div>
  );
}
