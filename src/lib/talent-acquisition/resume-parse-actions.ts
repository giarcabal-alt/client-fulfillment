"use server";

// ⚠️ parseResume extracts resume text server-side, then calls the
// Anthropic API (an external, third-party service) on every invocation —
// flagged for rate-limiting review per SECURITY.md, same as
// generateSuggestedMessage in draft-actions.ts. Unlike that action, there
// is no existing per-org daily-count table to key a cap off of here
// (candidate_drafts logs every draft generation; nothing in
// ATS_FEATURES.md's Step 1 schema logs every parse) — adding one is out
// of scope for Step 3, which only asked for extraction + normalization,
// not new schema. This is flagged as a real gap, not silently worked
// around.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { config } from "@/lib/config";
import { extractResumeText, isSupportedResumeType } from "./resume-text-extract";
import {
  resolveEntity,
  type AliasLookup,
  type FuzzyLookup,
} from "./skill-location-normalize";

export type ParseResumeState = {
  error: string | null;
  result: {
    skillsAutoMatched: number;
    skillsForReview: number;
    locationMatched: boolean;
    locationRaw: string | null;
  } | null;
};

const candidatePath = (id: string) => `/talent-acquisition/candidates/${id}`;

// A resume's raw text going into one Anthropic call, capped so a
// pathological file (or a PDF with garbage-extracted text) can't balloon
// token cost — a real resume's extracted text is a few thousand
// characters at most.
const MAX_RESUME_TEXT_LENGTH = 12_000;
// Bounds the extraction-result loop below against a model returning an
// implausibly long skills list.
const MAX_SKILLS_PROCESSED = 40;

const EXTENSION_TO_MIME: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

type ExtractedFields = {
  name: string | null;
  skills: string[];
  location: string | null;
  summary: string | null;
};

// Same convention as draft-actions.ts / resume-actions.ts's requireUser().
async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Not authenticated");
  }
  return { supabase, user };
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

export async function parseResume(candidateId: string): Promise<ParseResumeState> {
  try {
    const { supabase, user } = await requireUser();

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("org_id")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError || !profile) {
      throw new Error("Not authorized");
    }

    const { data: candidateRow, error: candidateError } = await supabase
      .from("candidates")
      .select("id, org_id, resume_path")
      .eq("id", candidateId)
      .maybeSingle();
    if (candidateError || !candidateRow) {
      throw new Error("Not authorized");
    }
    // Authorization beyond RLS (SECURITY.md): this action's next steps are
    // a Storage download and a third-party API call, both real side
    // effects — same explicit org compare as uploadResume/
    // generateSuggestedMessage, not just implicit trust in RLS.
    if (candidateRow.org_id !== profile.org_id) {
      throw new Error("Not authorized");
    }

    const resumePath = candidateRow.resume_path as string | null;
    if (!resumePath) {
      return { error: "Upload a resume before parsing it.", result: null };
    }

    const extension = resumePath.split(".").pop()?.toLowerCase() ?? "";
    const mimeType = EXTENSION_TO_MIME[extension];
    if (!mimeType || !isSupportedResumeType(mimeType)) {
      return { error: "Couldn't parse this resume. Please try again.", result: null };
    }

    const { data: fileBlob, error: downloadError } = await supabase.storage
      .from("resumes")
      .download(resumePath);
    if (downloadError || !fileBlob) {
      console.error("Failed to download resume for parsing:", downloadError);
      return { error: "Couldn't parse this resume. Please try again.", result: null };
    }

    let resumeText: string;
    try {
      const bytes = Buffer.from(await fileBlob.arrayBuffer());
      resumeText = (await extractResumeText(bytes, mimeType)).trim();
    } catch (extractError) {
      console.error("Failed to extract resume text:", extractError);
      return { error: "Couldn't read this resume file. Please try again.", result: null };
    }
    if (!resumeText) {
      return {
        error: "Couldn't find any readable text in this resume.",
        result: null,
      };
    }
    resumeText = resumeText.slice(0, MAX_RESUME_TEXT_LENGTH);

    if (!config.anthropic.apiKey) {
      // Missing server config, not a candidate/auth problem — still fails
      // securely with the same generic message (SECURITY.md). This is the
      // expected failure mode right now: ANTHROPIC_WORKSPACE_ID is not yet
      // set (see docs/PROJECT_STATE.md), so extraction cannot succeed
      // until that's resolved — built and wired correctly regardless.
      console.error("ANTHROPIC_API_KEY is not set");
      return { error: "Couldn't parse this resume. Please try again.", result: null };
    }

    let extracted: ExtractedFields;
    try {
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
      extracted = parseExtractionResponse(rawText);
    } catch (apiError) {
      // Fail securely — never forward Anthropic's raw error text or a raw
      // JSON-parse error to the client (SECURITY.md).
      console.error("Resume extraction call failed:", apiError);
      return { error: "Couldn't parse this resume. Please try again.", result: null };
    }

    const lookupSkillAlias: AliasLookup = async (normalizedText) => {
      const { data } = await supabase
        .from("skill_aliases")
        .select("skill_id")
        .eq("org_id", profile.org_id)
        .eq("alias", normalizedText)
        .maybeSingle();
      return data ? { id: data.skill_id as string } : null;
    };
    const lookupSkillFuzzy: FuzzyLookup = async (normalizedText) => {
      const { data } = await supabase.rpc("match_skill", {
        p_org_id: profile.org_id,
        p_text: normalizedText,
      });
      const row = (data as { skill_id: string; similarity: number }[] | null)?.[0];
      return row ? { id: row.skill_id, similarity: row.similarity } : null;
    };

    let skillsAutoMatched = 0;
    let skillsForReview = 0;
    const seenSkills = new Set<string>();
    for (const rawSkill of extracted.skills.slice(0, MAX_SKILLS_PROCESSED)) {
      const key = rawSkill.trim().toLowerCase();
      if (!key || seenSkills.has(key)) continue;
      seenSkills.add(key);

      const resolution = await resolveEntity(rawSkill, lookupSkillAlias, lookupSkillFuzzy);
      if (resolution.kind === "auto") {
        const { error: linkError } = await supabase
          .from("candidate_skills")
          .upsert(
            { candidate_id: candidateId, skill_id: resolution.id },
            { onConflict: "candidate_id,skill_id", ignoreDuplicates: true }
          );
        if (linkError) {
          console.error("Failed to link candidate skill:", linkError);
          continue;
        }
        skillsAutoMatched += 1;
      } else {
        const { error: reviewError } = await supabase.from("candidate_skill_reviews").insert({
          org_id: profile.org_id,
          candidate_id: candidateId,
          raw_text: rawSkill,
          suggested_skill_id: resolution.suggestedId,
          similarity: resolution.similarity,
        });
        if (reviewError) {
          console.error("Failed to queue skill for review:", reviewError);
          continue;
        }
        skillsForReview += 1;
      }
    }

    // Location: ATS_FEATURES.md's schema only gives a direct home for a
    // confident match (candidates.location_id) — there's no
    // location-review table in Step 1's schema the way
    // candidate_skill_reviews exists for skills, so a below-threshold
    // extracted location is surfaced back to the caller (see `result`
    // below) but not persisted anywhere. That's a known scope gap, not an
    // oversight — flagged in docs/PROJECT_STATE.md rather than inventing
    // a table ATS_FEATURES.md never specified.
    let locationMatched = false;
    if (extracted.location) {
      const lookupLocationAlias: AliasLookup = async (normalizedText) => {
        const { data } = await supabase
          .from("location_aliases")
          .select("location_id")
          .eq("org_id", profile.org_id)
          .eq("alias", normalizedText)
          .maybeSingle();
        return data ? { id: data.location_id as string } : null;
      };
      const lookupLocationFuzzy: FuzzyLookup = async (normalizedText) => {
        const { data } = await supabase.rpc("match_location", {
          p_org_id: profile.org_id,
          p_text: normalizedText,
        });
        const row = (data as { location_id: string; similarity: number }[] | null)?.[0];
        return row ? { id: row.location_id, similarity: row.similarity } : null;
      };

      const resolution = await resolveEntity(
        extracted.location,
        lookupLocationAlias,
        lookupLocationFuzzy
      );
      if (resolution.kind === "auto") {
        const { error: locationUpdateError } = await supabase
          .from("candidates")
          .update({ location_id: resolution.id })
          .eq("id", candidateId);
        if (!locationUpdateError) {
          locationMatched = true;
        } else {
          console.error("Failed to set candidate location:", locationUpdateError);
        }
      }
    }

    revalidatePath(candidatePath(candidateId));
    return {
      error: null,
      result: {
        skillsAutoMatched,
        skillsForReview,
        locationMatched,
        locationRaw: extracted.location,
      },
    };
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === "Not authenticated" || error.message === "Not authorized")
    ) {
      return { error: "Not authorized.", result: null };
    }
    console.error("Failed to parse resume:", error);
    return { error: "Couldn't parse this resume. Please try again.", result: null };
  }
}
