import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  EMPLOYMENT_STATUS_LABELS,
  NOTICE_PERIOD_LABELS,
  type EmploymentStatus,
  type NoticePeriod,
} from "@/lib/talent-acquisition/employment-fields";
import { StageChip } from "@/lib/talent-acquisition/stage-chip";
import type { BenchCandidate } from "./talent-bench-client";

// Only ever truncated for *display* — filtering/search still runs over a
// candidate's full skill list (see talent-bench-client.tsx), this cap is
// purely about not letting one candidate's card balloon past its
// neighbors in the grid.
const MAX_VISIBLE_SKILLS = 4;

export function TalentBenchCard({ candidate }: { candidate: BenchCandidate }) {
  const visibleSkills = candidate.skills.slice(0, MAX_VISIBLE_SKILLS);
  const hiddenSkillCount = candidate.skills.length - visibleSkills.length;

  const roleLine =
    candidate.lastRole || candidate.lastCompany
      ? [candidate.lastRole, candidate.lastCompany].filter(Boolean).join(" @ ")
      : null;

  return (
    <Card className="gap-0 overflow-visible p-0 transition-colors hover:border-work-blue has-[:focus-visible]:border-work-blue has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50">
      {/* Same Card-is-a-plain-div / real-<a>-inside pattern as
          candidate-card.tsx — Card has no polymorphic `render` prop, so a
          real interactive element lives inside it for keyboard/screen
          reader access, with the focus ring on the outer Card (via
          has-[:focus-visible]) since Card's own overflow-hidden would
          clip a ring painted flush on the child otherwise. */}
      <Link
        href={`/talent-acquisition/candidates/${candidate.id}`}
        className="flex h-full flex-col gap-1.5 rounded-xl p-2.5 outline-none"
      >
        <div className="flex items-start justify-between gap-2">
          <span className="min-w-0 truncate text-sm font-medium text-ink-navy">
            {candidate.name}
          </span>
          <StageChip
            stage={candidate.stage}
            status={candidate.status}
            className="shrink-0"
          />
        </div>

        <p className="truncate text-xs text-muted-foreground">
          {roleLine ?? "No work history on file"}
        </p>

        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-text">
          {candidate.yearsExperience != null && (
            <span className="tabular-nums">
              {candidate.yearsExperience} yr
              {candidate.yearsExperience === 1 ? "" : "s"} experience
            </span>
          )}
          {candidate.employmentStatus && (
            <span>
              {EMPLOYMENT_STATUS_LABELS[
                candidate.employmentStatus as EmploymentStatus
              ] ?? candidate.employmentStatus}
            </span>
          )}
          {candidate.noticePeriod && (
            <span>
              Notice:{" "}
              {NOTICE_PERIOD_LABELS[candidate.noticePeriod as NoticePeriod] ??
                candidate.noticePeriod}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {candidate.sourcePlatform && <span>{candidate.sourcePlatform}</span>}
          {candidate.communicationRating != null && (
            <span className="tabular-nums">
              Comms: {candidate.communicationRating}/5
            </span>
          )}
        </div>

        {visibleSkills.length > 0 && (
          <div className="mt-auto flex flex-wrap gap-1 pt-1">
            {visibleSkills.map((skill) => (
              <Badge key={skill} variant="secondary">
                {skill}
              </Badge>
            ))}
            {hiddenSkillCount > 0 && (
              <Badge variant="outline" className="tabular-nums">
                +{hiddenSkillCount}
              </Badge>
            )}
          </div>
        )}
      </Link>
    </Card>
  );
}
