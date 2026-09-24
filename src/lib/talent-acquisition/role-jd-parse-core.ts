// JD-parse-to-skills: the role-side counterpart to resume-parse-core.ts.
// Same split — a pure extraction/normalization step with no role_id
// required (works against any job description text, typed/pasted, not
// yet saved) and a separate persist step that writes decided results
// against a real role_id. Deliberately NOT a "use server" file, same
// reason as resume-parse-core.ts: it's imported by roles-actions.ts
// (already "use server") for both the create-role flow (persist happens
// at role-creation time, mirroring createCandidate's staged skill chips)
// and the role detail page's own "save skills" action, and a "use
// server" file's compile-time transform only preserves async-function
// exports — safest to keep this file plain and let the one "use server"
// file that needs it (roles-actions.ts) be the single place exposing
// these as real Server Actions.

import type { SupabaseClient } from "@supabase/supabase-js";
import { config } from "@/lib/config";
import { resolveSkills, type PersistSkillInput, type SkillMatch } from "./resume-parse-core";

function buildJdExtractionSystemPrompt(): string {
  return `You extract required skills/technologies/competencies from a job description for a recruiting database. Respond with ONLY a single JSON object, no markdown fences, no commentary, matching exactly this shape:

{"skills": string[]}

- "skills": a flat list of skill/technology/competency strings required or clearly implied by the role (e.g. "TypeScript", "Project Management") — no duplicates, no full sentences, no soft/personality traits ("team player").`;
}

function parseJdExtractionResponse(raw: string): string[] {
  let jsonText = raw.trim();
  // Models sometimes wrap JSON in a fenced block despite instructions not
  // to — tolerate that one specific case rather than failing on it, same
  // as resume-parse-core.ts's parseExtractionResponse.
  const fenced = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    jsonText = fenced[1].trim();
  }
  const parsed = JSON.parse(jsonText) as unknown;
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Extraction response was not a JSON object");
  }
  const obj = parsed as Record<string, unknown>;
  return Array.isArray(obj.skills)
    ? obj.skills.filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    : [];
}

// The one Anthropic call this feature makes — server-side only, per this
// app's standing convention (SECURITY.md; see draft-actions.ts's own
// "only file that calls api.anthropic.com" note, now joined by this one
// and resume-parse-core.ts's extractStructuredFields).
export async function extractSkillsFromJobDescription(
  jobDescription: string
): Promise<string[]> {
  if (!config.anthropic.apiKey) {
    throw new Error("ANTHROPIC_NOT_CONFIGURED");
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.anthropic.apiKey,
      "anthropic-version": "2023-06-01",
      ...(config.anthropic.workspaceId
        ? { "anthropic-workspace-id": config.anthropic.workspaceId }
        : {}),
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      system: buildJdExtractionSystemPrompt(),
      messages: [{ role: "user", content: jobDescription }],
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || `Anthropic API error (${res.status})`);
  }
  const rawText = ((data.content ?? []) as { text?: string }[])
    .map((block) => block.text ?? "")
    .join("\n")
    .trim();
  if (!rawText) {
    throw new Error("Empty response from Anthropic");
  }
  return parseJdExtractionResponse(rawText);
}

// Extraction + alias/pg_trgm normalization, no role_id required — reuses
// resolveSkills (resume-parse-core.ts) as-is: that function was already
// generic over "what org, what raw strings," with no candidate-specific
// logic inside it at all (the candidate-specific part is the separate
// persist step, which this module has its own role-scoped version of,
// below).
export async function parseJobDescriptionSkills(
  supabase: SupabaseClient,
  orgId: string,
  jobDescription: string
): Promise<SkillMatch[]> {
  const rawSkills = await extractSkillsFromJobDescription(jobDescription);
  return resolveSkills(supabase, orgId, rawSkills);
}

// The persist step: writes already-decided skill results against a real
// role_id. Same shape as resume-parse-core.ts's persistCandidateSkills,
// including the same re-verify-every-skillId-against-the-org rationale
// (role_skills' own RLS policy only checks the role row's org, not the
// skill row's — PROJECT_STATE.md §10's "join tables with no org_id of
// their own don't cross-check other foreign keys in RLS" note) — this
// function is fed skill ids that passed through client state (the role
// form's editable skill chips), so it can't skip the check.
export async function persistRoleSkills(
  supabase: SupabaseClient,
  orgId: string,
  roleId: string,
  skills: PersistSkillInput[]
): Promise<{ autoLinked: number; review: number }> {
  const roleSkillIds = [
    ...new Set(skills.map((s) => s.skillId).filter((id): id is string => !!id)),
  ];
  let visibleIds = new Set<string>();
  if (roleSkillIds.length > 0) {
    const { data } = await supabase.from("skills").select("id").in("id", roleSkillIds);
    visibleIds = new Set((data ?? []).map((s) => s.id as string));
  }

  let autoLinked = 0;
  let review = 0;
  for (const skill of skills) {
    const skillId = skill.skillId && visibleIds.has(skill.skillId) ? skill.skillId : null;
    if (skill.kind === "auto" && skillId) {
      const { error } = await supabase
        .from("role_skills")
        .upsert(
          { role_id: roleId, skill_id: skillId },
          { onConflict: "role_id,skill_id", ignoreDuplicates: true }
        );
      if (error) {
        console.error("Failed to link role skill:", error);
        continue;
      }
      autoLinked += 1;
    } else {
      const { error } = await supabase.from("role_skill_reviews").insert({
        org_id: orgId,
        role_id: roleId,
        raw_text: skill.rawText,
        suggested_skill_id: skillId,
        similarity: skill.similarity,
      });
      if (error) {
        console.error("Failed to queue role skill for review:", error);
        continue;
      }
      review += 1;
    }
  }
  return { autoLinked, review };
}
