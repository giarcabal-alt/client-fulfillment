import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { BOARD_STAGES } from "@/lib/talent-acquisition/cadence";

function stageLabelFor(value: string) {
  return BOARD_STAGES.find((s) => s.key === value)?.label ?? value;
}

type RoleEmbed = { title: string } | { title: string }[] | null;

// ATS_FEATURES.md Step 6's archive view — rejected candidates are never
// deleted (see rejectCandidate in candidates-actions.ts), just filtered
// off the main board. This is the "somewhere to still see them" the task
// asked for: a small standalone page reached via the board's "View
// rejected" link, the same header-link pattern roles/page.tsx already
// uses rather than a permanent sidebar entry, since this is an
// occasional-lookup view, not a daily-use module.
export default async function RejectedCandidatesPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("candidates")
    .select("id, name, stage, decline_reason, role:roles(title)")
    .eq("status", "rejected")
    .order("last_action_at", { ascending: false });

  if (error) {
    console.error("Failed to load rejected candidates:", error);
  }

  const candidates = (data ?? []).map((row) => {
    const roleEmbed = row.role as RoleEmbed;
    const role = Array.isArray(roleEmbed) ? roleEmbed[0] ?? null : roleEmbed;
    return {
      id: row.id as string,
      name: row.name as string,
      stage: row.stage as string,
      declineReason: row.decline_reason as string | null,
      roleTitle: role?.title ?? null,
    };
  });

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-4 sm:p-8">
      <div>
        <Button
          variant="outline"
          size="sm"
          className="mb-3"
          nativeButton={false}
          render={<Link href="/talent-acquisition/board">← Back to board</Link>}
        />
        <h1 className="text-2xl">Rejected candidates</h1>
        <p className="mt-1 text-muted-foreground">
          Declined candidates, kept for the record — not shown on the main
          board.
        </p>
      </div>

      {error && (
        <p className="text-sm text-destructive">
          Couldn&apos;t load rejected candidates. Please refresh the page.
        </p>
      )}

      {candidates.length === 0 ? (
        <Card>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              No candidates have been rejected yet.
            </p>
          </CardContent>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {candidates.map((c) => (
            <li key={c.id}>
              <Card>
                <CardContent className="flex flex-col gap-1.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <Link
                      href={`/talent-acquisition/candidates/${c.id}`}
                      className="font-medium text-ink-navy underline"
                    >
                      {c.name}
                    </Link>
                    <span className="text-xs text-muted-foreground">
                      {c.roleTitle ?? "No role set"} · last stage:{" "}
                      {stageLabelFor(c.stage)}
                    </span>
                  </div>
                  <p className="text-sm text-slate-text">
                    {c.declineReason ?? "No reason recorded."}
                  </p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
