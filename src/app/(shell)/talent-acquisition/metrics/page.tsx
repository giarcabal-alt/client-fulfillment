import { createClient } from "@/lib/supabase/server";
import { Section, SectionDivider } from "@/components/ui/section";
import { BOARD_STAGES } from "@/lib/talent-acquisition/cadence";
import {
  computeDeclineReasonBreakdown,
  computeTimeInStage,
  parseStageFromHistoryLabel,
  type StageDurationStat,
} from "@/lib/talent-acquisition/metrics";

// ATS_FEATURES.md Step 7, the last of the 7 steps — a metrics view, kept
// deliberately simple per that doc's own note: a handful of numbers and a
// compact table, not a charting library. Read-only queries against
// candidate_history/candidates, both already granted to `authenticated`
// (the blanket `grant ... on all tables in schema public` from
// 20260914060451_fix_grants_and_roles_delete_policy.sql covers every
// table, including ones added after it) and already org-scoped by their
// existing RLS select policies — no new schema, no new grants.
const STAGE_LABELS: Record<string, string> = Object.fromEntries(
  BOARD_STAGES.map((s) => [s.key, s.label])
);

export default async function MetricsPage() {
  const supabase = await createClient();

  const [
    { data: historyRows, error: historyError },
    { data: rejectedRows, error: rejectedError },
  ] = await Promise.all([
    supabase.from("candidate_history").select("candidate_id, label, occurred_at"),
    supabase.from("candidates").select("decline_reason").eq("status", "rejected"),
  ]);

  if (historyError) {
    console.error("Failed to load candidate history for metrics:", historyError);
  }
  if (rejectedError) {
    console.error("Failed to load rejected candidates for metrics:", rejectedError);
  }

  const events = (historyRows ?? [])
    .map((row) => {
      const stage = parseStageFromHistoryLabel(row.label as string);
      if (!stage) return null;
      return {
        candidateId: row.candidate_id as string,
        stage,
        occurredAt: row.occurred_at as string,
      };
    })
    .filter((event): event is NonNullable<typeof event> => event !== null);

  const statsByStage = new Map(
    computeTimeInStage(events).map((stat) => [stat.stage, stat])
  );
  // Pipeline order (matching the board's own column order), not sorted by
  // count or duration — this is a status readout, not a leaderboard.
  // Talent Pool is included in BOARD_STAGES but will realistically never
  // show data here: it's a deliberate dead end with no touches/cadence
  // (cadence.ts), so nothing ever moves a candidate OUT of it to close a
  // completed interval.
  const orderedStageStats: StageDurationStat[] = BOARD_STAGES.map(
    (s) => statsByStage.get(s.key)
  ).filter((stat): stat is StageDurationStat => stat !== undefined);

  const declineReasons = (rejectedRows ?? []).map(
    (row) => row.decline_reason as string | null
  );
  const declineStats = computeDeclineReasonBreakdown(declineReasons);

  return (
    <div className="flex h-full flex-col gap-3 p-4 sm:p-6">
      <div>
        <h1 className="font-display text-xl text-ink-navy">Metrics</h1>
        <p className="text-sm text-muted-foreground">
          Time-in-stage and decline-reason trends across the pipeline.
        </p>
      </div>

      {(historyError || rejectedError) && (
        <p className="text-sm text-destructive">
          Couldn&apos;t load some metrics. Please refresh the page.
        </p>
      )}

      <Section title="Average time in stage" bodyClassName="px-0" className="gap-0 py-0">
        {orderedStageStats.length === 0 ? (
          <p className="px-4 py-3 text-sm text-muted-foreground">
            No completed stage transitions yet — this fills in once a
            candidate has moved through at least two stages (a candidate
            still sitting in their very first stage doesn&apos;t count yet,
            since there&apos;s no way to know how long they&apos;ll stay
            there).
          </p>
        ) : (
          orderedStageStats.map((stat, i) => (
            <div key={stat.stage}>
              {i > 0 && <SectionDivider />}
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-4 py-2">
                <span className="text-sm font-medium text-ink-navy">
                  {STAGE_LABELS[stat.stage] ?? stat.stage}
                </span>
                <span className="text-xs text-muted-foreground">
                  <span className="font-medium tabular-nums text-ink-navy">
                    {stat.avgDays.toFixed(1)} {stat.avgDays === 1 ? "day" : "days"}
                  </span>{" "}
                  avg · {stat.transitionCount} completed{" "}
                  {stat.transitionCount === 1 ? "transition" : "transitions"}
                </span>
              </div>
            </div>
          ))
        )}
      </Section>

      <Section title="Decline reasons" bodyClassName="px-0" className="gap-0 py-0">
        {declineStats.length === 0 ? (
          <p className="px-4 py-3 text-sm text-muted-foreground">
            No rejections logged yet — this fills in once a candidate is
            declined with a reason from their detail page.
          </p>
        ) : (
          declineStats.map((stat, i) => (
            <div key={stat.reason}>
              {i > 0 && <SectionDivider />}
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-4 py-2">
                <span className="text-sm text-ink-navy">{stat.reason}</span>
                <span className="text-sm font-medium tabular-nums text-ink-navy">
                  {stat.count} {stat.count === 1 ? "candidate" : "candidates"}
                </span>
              </div>
            </div>
          ))
        )}
      </Section>
    </div>
  );
}
