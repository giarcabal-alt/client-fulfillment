import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getUserRole } from "@/lib/auth/get-user-role";
import { createClient } from "@/lib/supabase/server";
import {
  nextActionFor,
  statusFor,
  type CandidateStage,
} from "@/lib/talent-acquisition/cadence";
import { scriptFor } from "@/lib/talent-acquisition/scripts";
import { StatusBadge } from "@/lib/talent-acquisition/status-badge";
import { AssignmentField } from "./assignment-field";
import { CandidateDetailForm } from "./candidate-detail-form";

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
  ] = await Promise.all([
    supabase
      .from("candidates")
      .select(
        "id, name, stage, stage_entered_at, last_action_at, touch_index, notes, tags, role_id, assigned_to, source_platform, communication_rating, role:roles(id, title, job_description), assignee:profiles!assigned_to(id, display_name)"
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
    tags: candidateRow.tags as string | null,
    role_id: candidateRow.role_id as string | null,
    source_platform: candidateRow.source_platform as string | null,
    communication_rating: candidateRow.communication_rating as number | null,
  };

  const roles = (rolesData ?? []) as { id: string; title: string }[];
  const history = (historyData ?? []) as {
    id: string;
    label: string;
    occurred_at: string;
  }[];

  const action = nextActionFor(candidate);
  const status = statusFor(candidate, action);
  const script = scriptFor(action.script, {
    candidateName: candidate.name,
    roleTitle: role?.title ?? null,
    companyName: (settingsRow?.company_name as string | null) ?? null,
    recruiterName: (profileRow?.display_name as string | null) ?? null,
  });

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-4 sm:p-8">
      <div>
        <Link
          href="/talent-acquisition/board"
          className="text-sm text-work-blue underline"
        >
          ← Back to board
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl break-words">{candidate.name}</h1>
            <p className="mt-1 text-muted-foreground">
              {role?.title ?? "No role set"}
            </p>
          </div>
          <StatusBadge status={status} action={action} className="w-fit shrink-0" />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Candidate</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <CandidateDetailForm candidate={candidate} roles={roles} />
          <AssignmentField
            candidateId={candidate.id}
            assignee={assignee}
            isAdmin={isAdmin}
            assignableProfiles={assignableProfiles}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Next action</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm">{action.label}</p>
          {script ? (
            <pre className="whitespace-pre-wrap rounded-md border border-border bg-warm-paper p-3 font-sans text-sm text-slate-text">
              {script}
            </pre>
          ) : (
            <p className="text-sm text-muted-foreground">
              No scripted template at this stage.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Job description</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {role ? (
            <>
              <p className="whitespace-pre-wrap text-sm">
                {role.job_description || "No job description yet."}
              </p>
              <Link
                href="/talent-acquisition/roles"
                className="w-fit text-sm text-work-blue underline"
              >
                Edit on the roles page
              </Link>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              No role assigned — assign one above to see its job description.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">History</CardTitle>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>
    </div>
  );
}
