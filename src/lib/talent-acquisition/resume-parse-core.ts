// Shared resume-parsing core, split deliberately into "parse" (extract +
// AI-structure + normalize — no candidate_id required, works against any
// storage path) and "persist" (write already-decided results against a
// real candidate_id). Two different Server Actions call into this: the
// candidate detail page's `parseResume` (resume-parse-actions.ts, parses
// AND persists immediately for an existing candidate, unchanged behavior)
// and the New Candidate form's `uploadStagingResume`
// (new-candidate-resume-actions.ts, parses only — a staging path, no
// candidate exists yet — persistence happens later, at `createCandidate`
// submit time, against whatever the user finished editing in the form).
//
// Deliberately NOT a "use server" file — it's imported by two different
// "use server" action files and also exports plain synchronous helpers
// (finalizeSkillChips, mergeTagsWithSkillNames) that a "use server" file
// can't export at all (see PROJECT_STATE.md §10: such a file silently
// drops any non-async-function export from the client bundle).

import type { SupabaseClient } from "@supabase/supabase-js";
import { config } from "@/lib/config";
import { extractResumeText, isSupportedResumeType } from "./resume-text-extract";
import {
  resolveEntity,
  type AliasLookup,
  type FuzzyLookup,
} from "./skill-location-normalize";

// Same caps as Step 3's original single-file implementation — a real
// resume's extracted text is a few thousand characters at most; this
// bounds token cost against a pathological file. Skills capped against an
// implausible model output.
const MAX_RESUME_TEXT_LENGTH = 12_000;
const MAX_SKILLS_PROCESSED = 40;

const EXTENSION_TO_MIME: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export type ExtractedFields = {
  name: string | null;
  skills: string[];
  location: string | null;
  summary: string | null;
};

export type SkillMatch = {
  rawText: string;
  kind: "auto" | "review";
  // The matched skill (kind "auto") or the suggested skill, if any (kind
  // "review") — same dual role as candidate_skill_reviews.suggested_skill_id.
  skillId: string | null;
  skillName: string | null;
  similarity: number | null;
};

export type LocationMatch = {
  rawText: string | null;
  kind: "auto" | "unmatched";
  locationId: string | null;
  locationLabel: string | null;
  similarity: number | null;
};

export type ParsedResume = {
  name: string | null;
  summary: string | null;
  skills: SkillMatch[];
  location: LocationMatch;
};

export async function downloadAndExtractResumeText(
  supabase: SupabaseClient,
  storagePath: string
): Promise<string> {
  const extension = storagePath.split(".").pop()?.toLowerCase() ?? "";
  const mimeType = EXTENSION_TO_MIME[extension];
  if (!mimeType || !isSupportedResumeType(mimeType)) {
    throw new Error("UNSUPPORTED_FILE_TYPE");
  }

  const { data: fileBlob, error: downloadError } = await supabase.storage
    .from("resumes")
    .download(storagePath);
  if (downloadError || !fileBlob) {
    throw downloadError ?? new Error("DOWNLOAD_FAILED");
  }

  const bytes = Buffer.from(await fileBlob.arrayBuffer());
  const text = (await extractResumeText(bytes, mimeType)).trim();
  if (!text) {
    throw new Error("EMPTY_TEXT");
  }
  return text.slice(0, MAX_RESUME_TEXT_LENGTH);
}

function buildExtractionSystemPrompt(): string {
  return `You extract structured information from a candidate's resume text for a recruiting database. Respond with ONLY a single JSON object, no markdown fences, no commentary, matching exactly this shape:

{"name": string | null, "skills": string[], "location": string | null, "summary": string}

- "name": the candidate's full name if present, else null.
- "skills": a flat list of skill/technology/competency strings as they appear or are clearly implied in the resume (e.g. "TypeScript", "Project Management") — no duplicates, no full sentences.
- "location": the candidate's city (and province/region if stated) as a short string, else null.
- "summary": a 1-3 sentence neutral factual summary of the candidate's background. Never invent information not present in the text.`;
}

function parseExtractionResponse(raw: string): ExtractedFields {
  let jsonText = raw.trim();
  // Models sometimes wrap JSON in a fenced block despite instructions not
  // to — tolerate that one specific case rather than failing on it.
  const fenced = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    jsonText = fenced[1].trim();
  }
  const parsed = JSON.parse(jsonText) as unknown;
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Extraction response was not a JSON object");
  }
  const obj = parsed as Record<string, unknown>;
  const skills = Array.isArray(obj.skills)
    ? obj.skills.filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    : [];
  return {
    name: typeof obj.name === "string" ? obj.name : null,
    skills,
    location: typeof obj.location === "string" ? obj.location : null,
    summary: typeof obj.summary === "string" ? obj.summary : null,
  };
}

export async function extractStructuredFields(resumeText: string): Promise<ExtractedFields> {
  if (!config.anthropic.apiKey) {
    // Missing server config, not a candidate/auth problem — the caller
    // still fails securely with a generic message (SECURITY.md). This is
    // the expected failure mode right now: ANTHROPIC_WORKSPACE_ID is not
    // yet set (see docs/PROJECT_STATE.md).
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
      max_tokens: 1500,
      system: buildExtractionSystemPrompt(),
      messages: [{ role: "user", content: resumeText }],
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
  return parseExtractionResponse(rawText);
}

export async function resolveSkills(
  supabase: SupabaseClient,
  orgId: string,
  rawSkills: string[]
): Promise<SkillMatch[]> {
  const lookupAlias: AliasLookup = async (normalizedText) => {
    const { data } = await supabase
      .from("skill_aliases")
      .select("skill_id")
      .eq("org_id", orgId)
      .eq("alias", normalizedText)
      .maybeSingle();
    return data ? { id: data.skill_id as string } : null;
  };
  const lookupFuzzy: FuzzyLookup = async (normalizedText) => {
    const { data } = await supabase.rpc("match_skill", {
      p_org_id: orgId,
      p_text: normalizedText,
    });
    const row = (data as { skill_id: string; similarity: number }[] | null)?.[0];
    return row ? { id: row.skill_id, similarity: row.similarity } : null;
  };

  const seen = new Set<string>();
  const results: SkillMatch[] = [];
  for (const rawSkill of rawSkills.slice(0, MAX_SKILLS_PROCESSED)) {
    const key = rawSkill.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);

    const resolution = await resolveEntity(rawSkill, lookupAlias, lookupFuzzy);
    if (resolution.kind === "auto") {
      results.push({
        rawText: rawSkill,
        kind: "auto",
        skillId: resolution.id,
        skillName: null,
        similarity: resolution.similarity,
      });
    } else {
      results.push({
        rawText: rawSkill,
        kind: "review",
        skillId: resolution.suggestedId,
        skillName: null,
        similarity: resolution.similarity,
      });
    }
  }

  // Batch-fetch display names for every matched/suggested skill id — one
  // query rather than one per skill.
  const ids = [...new Set(results.map((r) => r.skillId).filter((id): id is string => !!id))];
  if (ids.length > 0) {
    const { data } = await supabase.from("skills").select("id, name").in("id", ids);
    const nameById = new Map((data ?? []).map((s) => [s.id as string, s.name as string]));
    for (const r of results) {
      if (r.skillId) r.skillName = nameById.get(r.skillId) ?? null;
    }
  }

  return results;
}

export async function resolveLocation(
  supabase: SupabaseClient,
  orgId: string,
  rawLocation: string | null
): Promise<LocationMatch> {
  if (!rawLocation || !rawLocation.trim()) {
    return { rawText: null, kind: "unmatched", locationId: null, locationLabel: null, similarity: null };
  }

  const lookupAlias: AliasLookup = async (normalizedText) => {
    const { data } = await supabase
      .from("location_aliases")
      .select("location_id")
      .eq("org_id", orgId)
      .eq("alias", normalizedText)
      .maybeSingle();
    return data ? { id: data.location_id as string } : null;
  };
  const lookupFuzzy: FuzzyLookup = async (normalizedText) => {
    const { data } = await supabase.rpc("match_location", {
      p_org_id: orgId,
      p_text: normalizedText,
    });
    const row = (data as { location_id: string; similarity: number }[] | null)?.[0];
    return row ? { id: row.location_id, similarity: row.similarity } : null;
  };

  const resolution = await resolveEntity(rawLocation, lookupAlias, lookupFuzzy);
  if (resolution.kind === "auto") {
    const { data } = await supabase
      .from("locations")
      .select("city, province")
      .eq("id", resolution.id)
      .maybeSingle();
    return {
      rawText: rawLocation,
      kind: "auto",
      locationId: resolution.id,
      locationLabel: data ? `${data.city}, ${data.province}` : null,
      similarity: resolution.similarity,
    };
  }
  return {
    rawText: rawLocation,
    kind: "unmatched",
    locationId: null,
    locationLabel: null,
    similarity: resolution.similarity,
  };
}

// The pure "parse" step (ATS_FEATURES.md Step 3, refactored per this
// task): raw text extraction + AI structuring + alias/pg_trgm
// normalization. Returns matched/unmatched results — never writes
// anything to candidate_skills/candidate_skill_reviews/candidates. Works
// against any storage path, staging or a real candidate's, since nothing
// here needs a candidate_id.
export async function parseResumeAtPath(
  supabase: SupabaseClient,
  orgId: string,
  storagePath: string
): Promise<ParsedResume> {
  const text = await downloadAndExtractResumeText(supabase, storagePath);
  const extracted = await extractStructuredFields(text);
  const skills = await resolveSkills(supabase, orgId, extracted.skills);
  const location = await resolveLocation(supabase, orgId, extracted.location);
  return { name: extracted.name, summary: extracted.summary, skills, location };
}

export type PersistSkillInput = {
  rawText: string;
  kind: "auto" | "review";
  skillId: string | null;
  similarity: number | null;
};

// The "persist" step: writes already-decided skill results against a real
// candidate_id. Always re-verifies every skillId is actually visible to
// this org before trusting it — not just for defense-in-depth, but
// because this function is also fed skill ids the *client* chose (the New
// Candidate form's skill chips, after the user has edited/removed some).
// candidate_skills' own RLS policy only checks the candidate row's org,
// not the skill row's (see PROJECT_STATE.md §10 — join tables with no
// org_id of their own don't cross-check a row's other foreign keys in
// RLS), so a scoped SELECT here is the only thing standing between a
// tampered request and linking a candidate to another org's skill.
export async function persistCandidateSkills(
  supabase: SupabaseClient,
  orgId: string,
  candidateId: string,
  skills: PersistSkillInput[]
): Promise<{ autoLinked: number; review: number }> {
  const candidateSkillIds = [
    ...new Set(skills.map((s) => s.skillId).filter((id): id is string => !!id)),
  ];
  let visibleIds = new Set<string>();
  if (candidateSkillIds.length > 0) {
    const { data } = await supabase.from("skills").select("id").in("id", candidateSkillIds);
    visibleIds = new Set((data ?? []).map((s) => s.id as string));
  }

  let autoLinked = 0;
  let review = 0;
  for (const skill of skills) {
    const skillId = skill.skillId && visibleIds.has(skill.skillId) ? skill.skillId : null;
    if (skill.kind === "auto" && skillId) {
      const { error } = await supabase
        .from("candidate_skills")
        .upsert(
          { candidate_id: candidateId, skill_id: skillId },
          { onConflict: "candidate_id,skill_id", ignoreDuplicates: true }
        );
      if (error) {
        console.error("Failed to link candidate skill:", error);
        continue;
      }
      autoLinked += 1;
    } else {
      const { error } = await supabase.from("candidate_skill_reviews").insert({
        org_id: orgId,
        candidate_id: candidateId,
        raw_text: skill.rawText,
        suggested_skill_id: skillId,
        similarity: skill.similarity,
      });
      if (error) {
        console.error("Failed to queue skill for review:", error);
        continue;
      }
      review += 1;
    }
  }
  return { autoLinked, review };
}

// --- Pure helpers for the New Candidate form's post-parse editing flow ---
// Both are plain, synchronous, and DB-free — unit-testable independent of
// the Anthropic call and of Postgres, the same discipline
// skill-location-normalize.ts already established.

export type SubmittedSkillChip = {
  rawText: string;
  currentText: string;
  kind: "auto" | "review";
  skillId: string | null;
  skillName: string | null;
  similarity: number | null;
};

// Decides, server-side (never trusting a client-computed "was this
// edited" flag), what each chip the user finished editing/removing
// actually persists as: an unedited "auto" chip with a still-known
// skillId persists as a confident match; anything else — a "review" chip,
// or ANY chip whose text was edited, even one that started out "auto" —
// persists into the review queue instead, since an edited string is no
// longer guaranteed to mean the skill it was originally matched against.
export function finalizeSkillChips(chips: SubmittedSkillChip[]): {
  persist: PersistSkillInput[];
  confirmedNames: string[];
} {
  const persist: PersistSkillInput[] = [];
  const confirmedNames: string[] = [];
  for (const chip of chips) {
    const text = chip.currentText.trim();
    if (!text) continue;
    const edited = text.toLowerCase() !== chip.rawText.trim().toLowerCase();

    if (chip.kind === "auto" && !edited && chip.skillId) {
      persist.push({ rawText: text, kind: "auto", skillId: chip.skillId, similarity: chip.similarity });
      if (chip.skillName) confirmedNames.push(chip.skillName);
    } else {
      persist.push({
        rawText: text,
        kind: "review",
        skillId: edited ? null : chip.skillId,
        similarity: edited ? null : chip.similarity,
      });
    }
  }
  return { persist, confirmedNames };
}

// Merges confirmed skill names into the existing tags column
// (case-insensitive dedupe against whatever the user already typed),
// rather than overwriting it — the Tags field is untouched when no resume
// was uploaded (empty skillNames), matching this task's "manual entry
// must keep working exactly as it does today" requirement.
export function mergeTagsWithSkillNames(
  existingTags: string | null,
  skillNames: string[]
): string | null {
  const merged = (existingTags ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  for (const name of skillNames) {
    if (!merged.some((t) => t.toLowerCase() === name.toLowerCase())) {
      merged.push(name);
    }
  }
  return merged.length > 0 ? merged.join(", ") : null;
}
