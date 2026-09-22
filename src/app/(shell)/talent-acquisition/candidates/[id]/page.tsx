import Link from "next/link";
import { notFound } from "next/navigation";
import { PropertyRow } from "@/components/ui/property-row";
import { Section } from "@/components/ui/section";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getUserRole } from "@/lib/auth/get-user-role";
import { createClient } from "@/lib/supabase/server";
import {
  nextActionFor,
  statusFor,
  type CandidateStage,
} from "@/lib/talent-acquisition/cadence";
import { scriptFor } from "@/lib/talent-acquisition/scripts";
import { StageChip } from "@/lib/talent-acquisition/stage-chip";
import { StatusBadge } from "@/lib/talent-acquisition/status-badge";
import { AssignmentField } from "./assignment-field";
import { CandidateDetailForm } from "./candidate-detail-form";
import { OutreachPanel } from "./outreach-panel";
import { RejectCandidatePanel } from "./reject-candidate-panel";
import { ResumeParse } from "./resume-parse";
import { ResumeUpload } from "./resume-upload";
import { ScorecardPanel, type Scorecard } from "./scorecard-panel";
import { SkillFitPanel } from "./skill-fit-panel";
import { type PendingSkillReview } from "./skill-reviews-panel";

type RoleEmbed = {
  id: string;
  title: string;
  job_description: string | null;
};

type ProfileEmbed = {
  id: string;
  display_name: string | null;
};

export default async function CandidateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    { data: candidateRow, error },
    { data: rolesData },
    { data: settingsRow },
    { data: historyData },
    { data: profileRow },
    userRole,
    { data: draftRow },
    { data: locationsData },
    { data: skillsData },
    { data: pendingReviewsData },
    { data: scorecardsData },
  ] = await Promise.all([
    supabase
      .from("candidates")
      .select(
        // `tags` deliberately not selected — the properties list dropped
        // it (see the Skills & Fit tab's chips and PROJECT_STATE.md §4);
        // the column itself stays in the schema, just unused by this page.
        "id, name, stage, stage_entered_at, last_action_at, touch_index, notes, role_id, assigned_to, source_platform, communication_rating, resume_path, location_id, status, decline_reason, years_experience, last_role, last_company, employment_status, notice_period, expected_compensation, role:roles(id, title, job_description), assignee:profiles!assigned_to(id, display_name)"
      )
      .eq("id", id)
      .maybeSingle(),
    supabase.from("roles").select("id, title").order("title"),
    supabase.from("org_settings").select("company_name").maybeSingle(),
    supabase
      .from("candidate_history")
      .select("id, label, occurred_at")
      .eq("candidate_id", id)
      .order("occurred_at", { ascending: false }),
    user
      ? supabase
          .from("profiles")
          .select("display_name")
          .eq("id", user.id)
          .maybeSingle()
      : Promise.resolve({ data: null as { display_name: string | null } | null }),
    getUserRole(),
    // Most recent draft for this candidate, any stage — the stage stored
    // alongside it (`stage`) is compared against the candidate's *current*
    // stage below, after both are loaded, since this query runs in
    // parallel with the candidate fetch and can't know the current stage
    // yet. A draft goes stale on stage change (BUILD_BRIEF.md §5): if the
    // candidate has since moved on, that comparison is what makes the old
    // draft disappear from the page rather than lingering as if it still
    // applied.
    supabase
      .from("candidate_drafts")
      .select("content, stage")
      .eq("candidate_id", id)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("locations").select("id, city, province").order("city"),
    supabase.from("skills").select("id, name").order("name"),
    // Prompt 4's "Needs Review" panel — only pending rows; confirmed/
    // rejected ones drop out once handled (see skill-review-actions.ts).
    supabase
      .from("candidate_skill_reviews")
      .select("id, raw_text, suggested_skill_id, similarity, suggested:skills(id, name)")
      .eq("candidate_id", id)
      .eq("status", "pending")
      .order("created_at", { ascending: true }),
    // Prompt 5's scorecard list — newest first, append-only per the
    // interview_scorecards RLS policy (select + insert only).
    supabase
      .from("interview_scorecards")
      .select(
        "id, rating, notes, stage_at_review, created_at, interviewer:profiles(id, display_name)"
      )
      .eq("candidate_id", id)
      .order("created_at", { ascending: false }),
  ]);

  if (error) {
    console.error("Failed to load candidate:", error);
  }
  if (!candidateRow) {
    notFound();
  }

  const isAdmin = userRole === "admin";

  // Only fetched for admins — the assignment control they alone can see.
  // RLS's "profiles: select own org" already scopes this to the caller's
  // own org with no extra filtering needed.
  const { data: assignableProfilesData } = isAdmin
    ? await supabase.from("profiles").select("id, display_name").order("display_name")
    : { data: null };
  const assignableProfiles = (assignableProfilesData ?? []).map((p) => ({
    id: p.id as string,
    displayName: p.display_name as string | null,
  }));

  const roleEmbed = candidateRow.role as RoleEmbed | RoleEmbed[] | null;
  const role = Array.isArray(roleEmbed) ? roleEmbed[0] ?? null : roleEmbed;

  const assigneeEmbed = candidateRow.assignee as ProfileEmbed | ProfileEmbed[] | null;
  const assigneeRow = Array.isArray(assigneeEmbed)
    ? assigneeEmbed[0] ?? null
    : assigneeEmbed;
  const assignee = assigneeRow
    ? { id: assigneeRow.id, displayName: assigneeRow.display_name }
    : null;

  const candidate = {
    id: candidateRow.id as string,
    name: candidateRow.name as string,
    stage: candidateRow.stage as CandidateStage,
    stage_entered_at: candidateRow.stage_entered_at as string,
    last_action_at: candidateRow.last_action_at as string | null,
    touch_index: candidateRow.touch_index as number,
    notes: candidateRow.notes as string | null,
    role_id: candidateRow.role_id as string | null,
    source_platform: candidateRow.source_platform as string | null,
    communication_rating: candidateRow.communication_rating as number | null,
    location_id: candidateRow.location_id as string | null,
    status: candidateRow.status as "active" | "rejected",
    decline_reason: candidateRow.decline_reason as string | null,
    years_experience: candidateRow.years_experience as number | null,
    last_role: candidateRow.last_role as string | null,
    last_company: candidateRow.last_company as string | null,
    employment_status: candidateRow.employment_status as string | null,
    notice_period: candidateRow.notice_period as string | null,
    expected_compensation: candidateRow.expected_compensation as string | null,
  };

  const roles = (rolesData ?? []) as { id: string; title: string }[];
  const locations = (locationsData ?? []) as {
    id: string;
    city: string;
    province: string;
  }[];
  const history = (historyData ?? []) as {
    id: string;
    label: string;
    occurred_at: string;
  }[];
  const skills = (skillsData ?? []) as { id: string; name: string }[];

  type SkillEmbed = { id: string; name: string } | { id: string; name: string }[] | null;
  const pendingReviews: PendingSkillReview[] = (pendingReviewsData ?? []).map((r) => {
    const suggestedEmbed = r.suggested as SkillEmbed;
    const suggested = Array.isArray(suggestedEmbed)
      ? (suggestedEmbed[0] ?? null)
      : suggestedEmbed;
    return {
      id: r.id as string,
      rawText: r.raw_text as string,
      suggestedSkillId: r.suggested_skill_id as string | null,
      suggestedSkillName: suggested?.name ?? null,
      similarity: r.similarity as number | null,
    };
  });

  type InterviewerEmbed =
    | { id: string; display_name: string | null }
    | { id: string; display_name: string | null }[]
    | null;
  const scorecards: Scorecard[] = (scorecardsData ?? []).map((s) => {
    const interviewerEmbed = s.interviewer as InterviewerEmbed;
    const interviewer = Array.isArray(interviewerEmbed)
      ? (interviewerEmbed[0] ?? null)
      : interviewerEmbed;
    return {
      id: s.id as string,
      rating: s.rating as number,
      notes: s.notes as string | null,
      stageAtReview: s.stage_at_review as string,
      interviewerName: interviewer?.display_name ?? null,
      createdAt: s.created_at as string,
    };
  });

  // Skills & Fit tab: needs the candidate's confirmed skills and the
  // assigned role's required skills, neither of which is known until
  // candidateRow (for role_id) has already loaded, so this runs
  // sequentially after it, same pattern as the admin-only
  // assignableProfiles fetch above.
  const [{ data: candidateSkillsData }, { data: roleSkillsData }] = await Promise.all([
    supabase.from("candidate_skills").select("skill_id").eq("candidate_id", id),
    candidate.role_id
      ? supabase.from("role_skills").select("skill_id").eq("role_id", candidate.role_id)
      : Promise.resolve({ data: [] as { skill_id: string }[] }),
  ]);
  const confirmedSkillIds = new Set(
    (candidateSkillsData ?? []).map((r) => r.skill_id as string)
  );
  const requiredSkillIds = new Set(
    (roleSkillsData ?? []).map((r) => r.skill_id as string)
  );
  // Names, not just counts — the Skills & Fit tab shows the actual chips:
  // Growth Green for a required skill the candidate has, neutral outline
  // for a required skill they're missing, and a separate neutral group for
  // confirmed skills that aren't tied to the assigned role at all.
  const matchedRequiredNames: string[] = [];
  const missingRequiredNames: string[] = [];
  const otherConfirmedNames: string[] = [];
  for (const s of skills) {
    const isRequired = requiredSkillIds.has(s.id);
    const isConfirmed = confirmedSkillIds.has(s.id);
    if (isRequired && isConfirmed) matchedRequiredNames.push(s.name);
    else if (isRequired && !isConfirmed) missingRequiredNames.push(s.name);
    else if (isConfirmed) otherConfirmedNames.push(s.name);
  }

  const action = nextActionFor(candidate);
  const status = statusFor(candidate, action);
  const script = scriptFor(action.script, {
    candidateName: candidate.name,
    roleTitle: role?.title ?? null,
    companyName: (settingsRow?.company_name as string | null) ?? null,
    recruiterName: (profileRow?.display_name as string | null) ?? null,
  });

  // Stale-on-stage-change (BUILD_BRIEF.md §5): only show the latest draft
  // if it was generated at the candidate's *current* stage — a draft left
  // over from a stage the candidate has since moved past no longer
  // applies, so the page falls back to "generate" instead of showing it.
  const initialDraft =
    draftRow && draftRow.stage === candidate.stage
      ? (draftRow.content as string)
      : null;

  // The `resumes` bucket is private — there's no public URL to just
  // build a string for. A signed URL has to be requested through the
  // RLS-scoped client (same "resumes: select within org" policy that
  // gates everything else in that bucket), generated fresh on every page
  // load rather than cached/stored, so it always reflects current
  // access and never outlives its own short expiry sitting unused in a
  // database row.
  const resumePath = candidateRow.resume_path as string | null;
  let resumeUrl: string | null = null;
  if (resumePath) {
    const { data: signedData, error: signedError } = await supabase.storage
      .from("resumes")
      .createSignedUrl(resumePath, 3600);
    if (signedError) {
      console.error("Failed to create signed resume URL:", signedError);
    }
    resumeUrl = signedData?.signedUrl ?? null;
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-3 p-4 sm:p-6">
      <div>
        <Link
          href="/talent-acquisition/board"
          className="text-sm text-work-blue underline"
        >
          ← Back to board
        </Link>

        {/* Compact header: name/role/stage/status + small actions, not a
            full card each for Resume and Reject (DESIGN_SYSTEM.md's
            Density §5). */}
        <div className="mt-1.5 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-xl text-ink-navy break-words">
              {candidate.name}
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {role?.title ?? "No role set"}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <StageChip stage={candidate.stage} status={candidate.status} />
            <StatusBadge status={status} action={action} className="w-fit" />
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <ResumeUpload candidateId={candidate.id} resumeUrl={resumeUrl} />
          <ResumeParse candidateId={candidate.id} hasResume={Boolean(resumePath)} />
          <RejectCandidatePanel
            candidateId={candidate.id}
            status={candidate.status}
            declineReason={candidate.decline_reason}
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:items-start">
        {/* Left: persistent Properties section, visible across every tab. */}
        <div className="flex flex-col gap-3">
          <Section title="Properties">
            <CandidateDetailForm
              candidate={candidate}
              roles={roles}
              locations={locations}
            />
            <PropertyRow label="Assigned to">
              <AssignmentField
                candidateId={candidate.id}
                assignee={assignee}
                isAdmin={isAdmin}
                assignableProfiles={assignableProfiles}
              />
            </PropertyRow>
          </Section>
        </div>

        {/* Right: tabbed — only one section's content renders at a time. */}
        <Section bodyClassName="px-3">
          <Tabs defaultValue="skills">
            <TabsList>
              <TabsTrigger value="skills">Skills & Fit</TabsTrigger>
              <TabsTrigger value="outreach">Outreach</TabsTrigger>
              <TabsTrigger value="scorecards">Scorecards</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>

            <TabsContent value="skills">
              <SkillFitPanel
                roleTitle={role?.title ?? null}
                jobDescription={role?.job_description ?? null}
                matchedRequired={matchedRequiredNames}
                missingRequired={missingRequiredNames}
                otherConfirmed={otherConfirmedNames}
                pendingReviews={pendingReviews}
                skills={skills}
              />
            </TabsContent>

            <TabsContent value="outreach">
              <OutreachPanel
                candidateId={candidate.id}
                actionLabel={action.label}
                script={script}
                initialDraft={initialDraft}
              />
            </TabsContent>

            <TabsContent value="scorecards">
              <ScorecardPanel candidateId={candidate.id} scorecards={scorecards} />
            </TabsContent>

            <TabsContent value="history">
              {history.length === 0 ? (
                <p className="text-sm text-muted-foreground">No history yet.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {history.map((h) => (
                    <li
                      key={h.id}
                      className="flex items-baseline justify-between gap-4 text-sm"
                    >
                      <span className="min-w-0 flex-1">{h.label}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {new Date(h.occurred_at).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>
          </Tabs>
        </Section>
      </div>
    </div>
  );
}
