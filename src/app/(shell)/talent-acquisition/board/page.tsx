import { createClient } from "@/lib/supabase/server";
import { BoardClient, type BoardCandidate } from "./board-client";

export default async function BoardPage() {
  const supabase = await createClient();
  const [
    { data, error },
    { data: rolesData, error: rolesError },
    { data: locationsData },
  ] = await Promise.all([
    // ATS_FEATURES.md Step 6: rejected candidates no longer appear on the
    // main board — filtered here, not deleted (see the sidebar's
    // "Rejected" link, which reuses Talent Bench pre-filtered to
    // status='rejected' rather than a separate archive page).
    supabase
      .from("candidates")
      .select(
        "id, name, stage, stage_entered_at, last_action_at, touch_index, tags, role:roles(title)"
      )
      .eq("status", "active"),
    supabase.from("roles").select("id, title").order("title"),
    supabase.from("locations").select("id, city, province").order("city"),
  ]);

  if (error) {
    console.error("Failed to load candidates:", error);
  }
  if (rolesError) {
    console.error("Failed to load roles:", rolesError);
  }

  const roles = (rolesData ?? []) as { id: string; title: string }[];
  const locations = (locationsData ?? []) as {
    id: string;
    city: string;
    province: string;
  }[];

  const candidates: BoardCandidate[] = (data ?? []).map((row) => {
    const role = row.role as { title: string } | { title: string }[] | null;
    const roleTitle = Array.isArray(role) ? role[0]?.title : role?.title;
    return {
      id: row.id as string,
      name: row.name as string,
      stage: row.stage as BoardCandidate["stage"],
      stage_entered_at: row.stage_entered_at as string,
      last_action_at: row.last_action_at as string | null,
      touch_index: row.touch_index as number,
      tags: row.tags as string | null,
      roleTitle: roleTitle ?? null,
    };
  });

  return (
    <div className="flex h-full flex-col gap-4 p-4 sm:p-8">
      <div className="min-w-0">
        <h1 className="text-2xl">Talent Acquisition Desk</h1>
        <p className="mt-1 text-muted-foreground">
          The candidate pipeline, Talent Pool included.
        </p>
      </div>

      {error && (
        <p className="text-sm text-destructive">
          Couldn&apos;t load candidates. Please refresh the page.
        </p>
      )}

      <BoardClient candidates={candidates} roles={roles} locations={locations} />
    </div>
  );
}
