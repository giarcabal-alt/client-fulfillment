// Normalization decision logic for ATS_FEATURES.md Step 3: given one raw
// extracted string (a skill or a location), decide whether it auto-links
// to an existing canonical row, goes to the review queue with a suggested
// match, or goes to the review queue as a possibly-new entry with no
// suggestion. Thresholds and the two-stage (exact alias, then fuzzy)
// lookup order come straight from ATS_FEATURES.md's "Schema (Step 1)"
// section.
//
// The actual lookups (skill_aliases exact match, pg_trgm fuzzy match via
// the match_skill/match_location Postgres functions) live in
// resume-parse-actions.ts and are injected here as plain async functions
// — that's what makes this module testable with vitest, independent of a
// live Postgres connection, the same way cadence.ts's pure functions are
// tested without a DB.

// ATS_FEATURES.md "Starting fuzzy-match threshold": ≥0.6 auto-accepts;
// 0.35-0.6 goes to review as a suggestion; <0.35 goes to review with no
// suggestion (a possibly-new entry).
export const AUTO_ACCEPT_THRESHOLD = 0.6;
export const REVIEW_THRESHOLD = 0.35;

export type AliasLookup = (
  normalizedText: string
) => Promise<{ id: string } | null>;

export type FuzzyLookup = (
  normalizedText: string
) => Promise<{ id: string; similarity: number } | null>;

export type EntityResolution =
  | { kind: "auto"; id: string; similarity: number }
  | { kind: "review"; suggestedId: string | null; similarity: number | null };

// Shared by both skills and locations — ATS_FEATURES.md specifies "the
// same normalization approach" for both, so one function serves both
// rather than two near-duplicates.
export async function resolveEntity(
  rawText: string,
  lookupAlias: AliasLookup,
  lookupFuzzy: FuzzyLookup
): Promise<EntityResolution> {
  const normalized = rawText.trim().toLowerCase();

  const aliasMatch = await lookupAlias(normalized);
  if (aliasMatch) {
    return { kind: "auto", id: aliasMatch.id, similarity: 1 };
  }

  const fuzzyMatch = await lookupFuzzy(normalized);
  if (fuzzyMatch && fuzzyMatch.similarity >= AUTO_ACCEPT_THRESHOLD) {
    return { kind: "auto", id: fuzzyMatch.id, similarity: fuzzyMatch.similarity };
  }
  if (fuzzyMatch && fuzzyMatch.similarity >= REVIEW_THRESHOLD) {
    return {
      kind: "review",
      suggestedId: fuzzyMatch.id,
      similarity: fuzzyMatch.similarity,
    };
  }
  return {
    kind: "review",
    suggestedId: null,
    similarity: fuzzyMatch?.similarity ?? null,
  };
}
