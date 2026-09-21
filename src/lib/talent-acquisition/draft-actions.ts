"use server";

// ⚠️ generateSuggestedMessage calls the Anthropic API (an external,
// third-party service) on every invocation — flagged for rate-limiting
// review per SECURITY.md ("any action that mutates state, sends external
// requests, or triggers a side effect must be flagged"). The per-org daily
// cap below is a basic backstop against a runaway loop, not a substitute
// for a real rate-limiting review before this sees production traffic at
// any real volume.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { config } from "@/lib/config";
import {
  BOARD_STAGES,
  nextActionFor,
  type CandidateForCadence,
} from "@/lib/talent-acquisition/cadence";
import { scriptFor } from "@/lib/talent-acquisition/scripts";

export type DraftActionState = { error: string | null; content: string | null };

const candidatePath = (id: string) => `/talent-acquisition/candidates/${id}`;

// BUILD_BRIEF.md §5: "a basic per-org daily cap (e.g. 200 generations/day/
// org) is enough for v1" — a flat backstop, not precision quota
// management. Cost stays flat per call regardless of pipeline length since
// this is single-shot, not an accumulating thread, so this exists purely
// to catch a runaway loop, not to manage steady-state cost.
const DAILY_GENERATION_CAP = 200;
const MAX_EXTRA_CONTEXT_LENGTH = 2000;

type RoleEmbed = { title: string; job_description: string | null };

function stageLabelFor(stage: string): string {
  return BOARD_STAGES.find((s) => s.key === stage)?.label ?? stage;
}

// Ported from the prototype's buildSystemPrompt() (recruiting-desk.html,
// BUILD_BRIEF.md §5, §8) — same shape, fed from real DB data instead of
// local-storage state.
function buildSystemPrompt(params: {
  recruiterName: string | null;
  companyName: string | null;
  candidateName: string;
  roleTitle: string | null;
  stageLabel: string;
  actionLabel: string;
  notes: string | null;
  styleRef: string;
}): string {
  const {
    recruiterName,
    companyName,
    candidateName,
    roleTitle,
    stageLabel,
    actionLabel,
    notes,
    styleRef,
  } = params;

  return `You are helping ${recruiterName || "a recruiter"} at ${
    companyName || "a company"
  } write short, natural recruiting emails and chat messages for one specific candidate. Only output the message itself (no "Here's a draft:" preamble) unless the recruiter asks for something else, like advice rather than a draft.

Candidate: ${candidateName}
Role: ${roleTitle || "not specified"}
Current pipeline stage: ${stageLabel}
Typical next action at this stage: ${actionLabel}
Recruiter's notes on this candidate: ${notes || "none"}

Reference tone/style for this stage (a starting point, not something to repeat verbatim):
"""
${styleRef}
"""

When the recruiter pastes something the candidate said or wrote, respond to what they actually said — don't just restate the generic script. Keep messages concise, warm, specific, and free of corporate fluff. Calls beat emails at high-stakes moments (offers, negotiation, deadlines); mention that if relevant, but don't lecture about it in every reply.`;
}

// Every action in this file re-derives the user server-side via
// getUser() (never getSession(), never a client-passed id) per
// SECURITY.md — same convention as candidates-actions.ts's requireUser().
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

export async function generateSuggestedMessage(
  candidateId: string,
  extraContext?: string
): Promise<DraftActionState> {
  if (extraContext && extraContext.length > MAX_EXTRA_CONTEXT_LENGTH) {
    return { error: "That's too long — try trimming it.", content: null };
  }

  try {
    const { supabase, user } = await requireUser();

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("org_id, display_name")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError || !profile) {
      throw new Error("Not authorized");
    }

    const { data: candidateRow, error: candidateError } = await supabase
      .from("candidates")
      .select(
        "id, org_id, name, stage, stage_entered_at, last_action_at, touch_index, notes, role:roles(title, job_description)"
      )
      .eq("id", candidateId)
      .maybeSingle();
    if (candidateError || !candidateRow) {
      throw new Error("Not authorized");
    }

    // Authorization beyond RLS (SECURITY.md): this action's next step is a
    // third-party API call, a real side effect, so it needs its own
    // explicit check — not just trust that the scoped SELECT above would
    // have returned null for a candidate RLS hides. RLS's org policy
    // already makes that true today, but this check doesn't rely on it:
    // it compares the two org_ids directly, the same "confirm before doing
    // anything" shape BUILD_BRIEF.md §5 calls for.
    if (candidateRow.org_id !== profile.org_id) {
      throw new Error("Not authorized");
    }

    const roleEmbed = candidateRow.role as RoleEmbed | RoleEmbed[] | null;
    const role = Array.isArray(roleEmbed) ? (roleEmbed[0] ?? null) : roleEmbed;

    const { data: settingsRow } = await supabase
      .from("org_settings")
      .select("company_name")
      .eq("org_id", profile.org_id)
      .maybeSingle();

    // Basic per-org daily cap (BUILD_BRIEF.md §5) — a backstop against a
    // runaway loop, checked before spending an API call, not after.
    // candidate_drafts has no org_id column of its own (see the initial
    // schema migration), so the count goes through an inner join to
    // candidates, the same org-scoping shape as the RLS policies on this
    // table use.
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const { count, error: countError } = await supabase
      .from("candidate_drafts")
      .select("id, candidates!inner(org_id)", { count: "exact", head: true })
      .eq("candidates.org_id", profile.org_id)
      .gte("generated_at", startOfDay.toISOString());
    if (countError) throw countError;
    if ((count ?? 0) >= DAILY_GENERATION_CAP) {
      return {
        error: "Today's generation limit has been reached. Try again tomorrow.",
        content: null,
      };
    }

    const candidateForCadence: CandidateForCadence = {
      stage: candidateRow.stage,
      stage_entered_at: candidateRow.stage_entered_at,
      last_action_at: candidateRow.last_action_at,
      touch_index: candidateRow.touch_index,
    };
    const action = nextActionFor(candidateForCadence);
    const styleRef =
      scriptFor(action.script, {
        candidateName: candidateRow.name,
        roleTitle: role?.title ?? null,
        companyName: (settingsRow?.company_name as string | null) ?? null,
        recruiterName: profile.display_name,
      }) ?? "(no scripted template at this stage)";

    const systemPrompt = buildSystemPrompt({
      recruiterName: profile.display_name,
      companyName: (settingsRow?.company_name as string | null) ?? null,
      candidateName: candidateRow.name,
      roleTitle: role?.title ?? null,
      stageLabel: stageLabelFor(candidateRow.stage),
      actionLabel: action.label,
      notes: candidateRow.notes,
      styleRef,
    });

    if (!config.anthropic.apiKey) {
      // Missing server config, not a candidate/auth problem — still fails
      // securely with the same generic message (SECURITY.md).
      console.error("ANTHROPIC_API_KEY is not set");
      return { error: "Couldn't generate a draft, try again.", content: null };
    }

    let content: string;
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": config.anthropic.apiKey,
          "anthropic-version": "2023-06-01",
          // Only sent if configured — an unscoped API key requires this,
          // a workspace-scoped one doesn't. See config.ts.
          ...(config.anthropic.workspaceId
            ? { "anthropic-workspace-id": config.anthropic.workspaceId }
            : {}),
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          system: systemPrompt,
          messages: [
            {
              role: "user",
              content: extraContext?.trim() || "Write the message now.",
            },
          ],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || `Anthropic API error (${res.status})`);
      }
      content = ((data.content ?? []) as { text?: string }[])
        .map((block) => block.text ?? "")
        .join("\n")
        .trim();
      if (!content) {
        throw new Error("Empty response from Anthropic");
      }
    } catch (apiError) {
      // Fail securely — never forward Anthropic's raw error text to the
      // client (SECURITY.md).
      console.error("Anthropic API call failed:", apiError);
      return { error: "Couldn't generate a draft, try again.", content: null };
    }

    // Persisted as an audit-trail row, not a thread to re-send — one row
    // per generation (BUILD_BRIEF.md §5). Treated as load-bearing: if this
    // fails, don't hand the caller a draft with no record of it existing.
    const { error: insertError } = await supabase.from("candidate_drafts").insert({
      candidate_id: candidateId,
      stage: candidateRow.stage,
      content,
      generated_by: user.id,
    });
    if (insertError) {
      console.error("Failed to persist candidate draft:", insertError);
      return { error: "Couldn't generate a draft, try again.", content: null };
    }

    revalidatePath(candidatePath(candidateId));
    return { error: null, content };
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === "Not authenticated" || error.message === "Not authorized")
    ) {
      return { error: "Not authorized.", content: null };
    }
    console.error("Failed to generate suggested message:", error);
    return { error: "Couldn't generate a draft, try again.", content: null };
  }
}
