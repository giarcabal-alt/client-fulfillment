import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { SectionDivider } from "@/components/ui/section";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createClient } from "@/lib/supabase/server";
import { JobDescriptionEditor } from "./job-description-editor";
import { RoleDetailForm, type RoleDetail } from "./role-detail-form";
import { RoleSkillsEditor } from "../role-skills-editor";

type ClientEmbed = {
  id: string;
  company_name: string;
  timezone: string | null;
} | {
  id: string;
  company_name: string;
  timezone: string | null;
}[] | null;

export default async function RoleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [
    { data: roleRow, error },
    { data: clientsData },
    { data: roleSkillsData },
    { data: pendingReviewsData },
    { data: candidatesData },
    { data: historyData },
  ] = await Promise.all([
    supabase
      .from("roles")
      .select(
        "id, title, job_description, status, client_id, compensation, payment_terms, seniority_level, work_arrangement, timezone_overlap, classification, priority, target_fill_date, client:clients(id, company_name, timezone)"
      )
      .eq("id", id)
      .maybeSingle(),
    supabase.from("clients").select("id, company_name, timezone").order("company_name"),
    supabase.from("role_skills").select("skill:skills(id, name)").eq("role_id", id),
    supabase
      .from("role_skill_reviews")
      .select("id, raw_text, suggested_skill_id, similarity")
      .eq("role_id", id)
      .eq("status", "pending"),
    supabase.from("candidates").select("id, name, stage").eq("role_id", id).order("name"),
    supabase
      .from("role_history")
      .select("id, label, occurred_at")
      .eq("role_id", id)
      .order("occurred_at", { ascending: false }),
  ]);

  if (error || !roleRow) {
    notFound();
  }

  const clientEmbed = roleRow.client as ClientEmbed;
  const client = Array.isArray(clientEmbed) ? clientEmbed[0] ?? null : clientEmbed;

  const role: RoleDetail = {
    id: roleRow.id as string,
    title: roleRow.title as string,
    job_description: roleRow.job_description as string | null,
    status: roleRow.status as RoleDetail["status"],
    client_id: roleRow.client_id as string | null,
    compensation: roleRow.compensation as string | null,
    payment_terms: roleRow.payment_terms as string | null,
    seniority_level: roleRow.seniority_level as string | null,
    work_arrangement: roleRow.work_arrangement as string | null,
    timezone_overlap: roleRow.timezone_overlap as string | null,
    classification: roleRow.classification as string | null,
    priority: roleRow.priority as string | null,
    target_fill_date: roleRow.target_fill_date as string | null,
  };

  const clients = (clientsData ?? []).map((c) => ({
    id: c.id as string,
    company_name: c.company_name as string,
    timezone: c.timezone as string | null,
  }));

  type SkillEmbed = { id: string; name: string } | { id: string; name: string }[] | null;
  const matchedSkills = (roleSkillsData ?? [])
    .map((row) => {
      const embed = row.skill as SkillEmbed;
      return Array.isArray(embed) ? embed[0] ?? null : embed;
    })
    .filter((s): s is { id: string; name: string } => s !== null);

  const initialChips = [
    ...matchedSkills.map((s) => ({
      rawText: s.name,
      currentText: s.name,
      kind: "auto" as const,
      skillId: s.id,
      skillName: s.name,
      similarity: 1,
    })),
    ...(pendingReviewsData ?? []).map((r) => ({
      rawText: r.raw_text as string,
      currentText: r.raw_text as string,
      kind: "review" as const,
      skillId: r.suggested_skill_id as string | null,
      skillName: null,
      similarity: r.similarity as number | null,
    })),
  ];

  const candidates = (candidatesData ?? []).map((c) => ({
    id: c.id as string,
    name: c.name as string,
    stage: c.stage as string,
  }));

  const history = (historyData ?? []).map((h) => ({
    id: h.id as string,
    label: h.label as string,
    occurred_at: h.occurred_at as string,
  }));

  return (
    <div className="flex w-full flex-col gap-3 p-4 sm:p-6">
      <Button
        variant="outline"
        size="sm"
        className="w-fit"
        nativeButton={false}
        render={<Link href="/talent-acquisition/roles">← Back to Job Openings</Link>}
      />

      <RoleDetailForm role={role} clients={clients}>
        <Tabs defaultValue="skills">
          <TabsList>
            <TabsTrigger value="skills">Skills</TabsTrigger>
            <TabsTrigger value="jd">Job Description</TabsTrigger>
            <TabsTrigger value="candidates">Candidates</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="skills">
            <RoleSkillsEditor
              roleId={role.id}
              jobDescription={role.job_description ?? ""}
              initialChips={initialChips}
            />
          </TabsContent>

          <TabsContent value="jd">
            <JobDescriptionEditor
              roleId={role.id}
              initialJobDescription={role.job_description ?? ""}
            />
          </TabsContent>

          <TabsContent value="candidates">
            {candidates.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No candidates linked to this role yet.
              </p>
            ) : (
              <div className="flex flex-col">
                {candidates.map((c, i) => (
                  <div key={c.id}>
                    {i > 0 && <SectionDivider />}
                    <Link
                      href={`/talent-acquisition/candidates/${c.id}`}
                      className="flex items-center justify-between gap-3 py-2 text-sm hover:bg-stone/30"
                    >
                      <span className="text-ink-navy">{c.name}</span>
                      <span className="text-xs text-muted-foreground">{c.stage}</span>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="history">
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No status changes logged yet.
              </p>
            ) : (
              <div className="flex flex-col">
                {history.map((h, i) => (
                  <div key={h.id}>
                    {i > 0 && <SectionDivider />}
                    <div className="flex items-center justify-between gap-3 py-2 text-sm">
                      <span className="text-ink-navy">{h.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(h.occurred_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </RoleDetailForm>
    </div>
  );
}
