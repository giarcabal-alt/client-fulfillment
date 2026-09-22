import { Badge } from "@/components/ui/badge";
import { SectionDivider } from "@/components/ui/section";
import { JobDescriptionPanel } from "./job-description-panel";
import { SkillReviewsPanel, type PendingSkillReview } from "./skill-reviews-panel";

// The "Skills & Fit" tab: shows the actual matched/missing skills (not
// just a count), per the density-and-layout task that replaced the old
// "N of M required skills matched" one-liner with real chip lists —
// Growth Green for a required skill the candidate has confirmed, neutral
// outline for a required skill they're missing, and a third neutral group
// for confirmed skills that aren't tied to the assigned role's
// requirements at all. Server-renderable (no "use client") — the chip
// lists are plain data, and the two interactive pieces it composes
// (SkillReviewsPanel, JobDescriptionPanel) are themselves client
// components rendered as children.
export function SkillFitPanel({
  roleTitle,
  jobDescription,
  matchedRequired,
  missingRequired,
  otherConfirmed,
  pendingReviews,
  skills,
}: {
  roleTitle: string | null;
  jobDescription: string | null;
  matchedRequired: string[];
  missingRequired: string[];
  otherConfirmed: string[];
  pendingReviews: PendingSkillReview[];
  skills: { id: string; name: string }[];
}) {
  const requiredTotal = matchedRequired.length + missingRequired.length;
  const hasAnySkills =
    matchedRequired.length > 0 || missingRequired.length > 0 || otherConfirmed.length > 0;

  return (
    <div className="flex flex-col gap-4">
      {roleTitle && requiredTotal > 0 && (
        <p className="text-sm text-slate-text">
          {matchedRequired.length} of {requiredTotal} required skills matched for{" "}
          {roleTitle}
        </p>
      )}

      {!hasAnySkills ? (
        <p className="text-sm text-muted-foreground">No confirmed skills yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {matchedRequired.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-muted-foreground">
                Matched required skills
              </span>
              <div className="flex flex-wrap gap-1.5">
                {matchedRequired.map((name) => (
                  <Badge
                    key={name}
                    variant="outline"
                    className="border-growth-green/40 bg-growth-green/10 text-growth-green"
                  >
                    {name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {missingRequired.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-muted-foreground">
                Missing required skills
              </span>
              <div className="flex flex-wrap gap-1.5">
                {missingRequired.map((name) => (
                  <Badge key={name} variant="outline">
                    {name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {otherConfirmed.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-muted-foreground">
                Other confirmed skills
              </span>
              <div className="flex flex-wrap gap-1.5">
                {otherConfirmed.map((name) => (
                  <Badge key={name} variant="secondary">
                    {name}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <SectionDivider />

      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-muted-foreground">Needs review</span>
        <SkillReviewsPanel reviews={pendingReviews} skills={skills} />
      </div>

      <SectionDivider />

      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-muted-foreground">Job description</span>
        <JobDescriptionPanel roleTitle={roleTitle} jobDescription={jobDescription} />
      </div>
    </div>
  );
}
