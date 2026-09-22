import Link from "next/link";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { TalentBenchClient, type BenchCandidate } from "./talent-bench-client";

// Talent Bench: every candidate, regardless of stage or status — the
// board (and its "active only" filter, see ATS_FEATURES.md Step 6) is a
// *pipeline* view; this is a *roster* view, for scanning/filtering the
// whole bench including rejected candidates who may still be worth
// re-approaching for a different role later. Card grid, not a kanban
// board — there's no single "column" a candidate belongs in here.
export default async function TalentBenchPage() {
  const supabase = await createClient();
  const [{ data, error }, { data: skillLinksData }] = await Promise.all([
    supabase
      .from("candidates")
      .select(
        "id, name, stage, status, last_role, last_company, years_experience, employment_status, notice_period, source_platform, communication_rating, tags"
      )
      .order("name"),
    // candidate_skills has no status filter of its own — every row here
    // is already a *confirmed* skill (see candidate_skill_reviews for the
    // separate pending-review queue), so no extra filtering is needed to
    // show only confirmed skill chips.
    supabase.from("candidate_skills").select("candidate_id, skill:skills(name)"),
  ]);

  if (error) {
    console.error("Failed to load candidates for Talent Bench:", error);
  }

  type SkillEmbed = { name: string } | { name: string }[] | null;
  const skillsByCandidate = new Map<string, string[]>();
  for (const row of skillLinksData ?? []) {
    const embed = row.skill as SkillEmbed;
    const skill = Array.isArray(embed) ? embed[0] ?? null : embed;
    if (!skill) continue;
    const candidateId = row.candidate_id as string;
    const list = skillsByCandidate.get(candidateId) ?? [];
    list.push(skill.name);
    skillsByCandidate.set(candidateId, list);
  }

  const candidates: BenchCandidate[] = (data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    stage: row.stage as BenchCandidate["stage"],
    status: row.status as "active" | "rejected",
    lastRole: row.last_role as string | null,
    lastCompany: row.last_company as string | null,
    yearsExperience: row.years_experience as number | null,
    employmentStatus: row.employment_status as string | null,
    noticePeriod: row.notice_period as string | null,
    sourcePlatform: row.source_platform as string | null,
    communicationRating: row.communication_rating as number | null,
    tags: row.tags as string | null,
    skills: skillsByCandidate.get(row.id as string) ?? [],
  }));

  return (
    <div className="flex h-full flex-col gap-4 p-4 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl">Talent Bench</h1>
          <p className="mt-1 text-muted-foreground">
            Every candidate on file, active and rejected — filter and search
            the whole bench.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="mt-1 shrink-0"
          nativeButton={false}
          render={<Link href="/talent-acquisition/board">← Back to board</Link>}
        />
      </div>

      {error && (
        <p className="text-sm text-destructive">
          Couldn&apos;t load candidates. Please refresh the page.
        </p>
      )}

      <TalentBenchClient candidates={candidates} />
    </div>
  );
}
