import { describe, expect, it, vi } from "vitest";
import {
  AUTO_ACCEPT_THRESHOLD,
  REVIEW_THRESHOLD,
  resolveEntity,
  type AliasLookup,
  type FuzzyLookup,
} from "./skill-location-normalize";

// Fakes standing in for skill_aliases exact-match / match_skill(...)
// pg_trgm RPC lookups — see the module comment for why these are
// injected rather than hitting a real Postgres connection here.
function aliasLookup(result: { id: string } | null): AliasLookup {
  return vi.fn().mockResolvedValue(result);
}
function fuzzyLookup(result: { id: string; similarity: number } | null): FuzzyLookup {
  return vi.fn().mockResolvedValue(result);
}

describe("resolveEntity", () => {
  it("auto-accepts on an exact alias match without ever calling the fuzzy lookup", async () => {
    const alias = aliasLookup({ id: "skill-ts" });
    const fuzzy = fuzzyLookup({ id: "skill-wrong", similarity: 0.9 });

    const result = await resolveEntity("ts", alias, fuzzy);

    expect(result).toEqual({ kind: "auto", id: "skill-ts", similarity: 1 });
    expect(fuzzy).not.toHaveBeenCalled();
  });

  it("normalizes case and whitespace before the alias lookup", async () => {
    const alias = aliasLookup({ id: "skill-ts" });
    const fuzzy = fuzzyLookup(null);

    await resolveEntity("  TypeScript  ", alias, fuzzy);

    expect(alias).toHaveBeenCalledWith("typescript");
  });

  it("falls back to pg_trgm similarity when there is no alias match", async () => {
    const alias = aliasLookup(null);
    const fuzzy = fuzzyLookup({ id: "skill-python", similarity: 0.75 });

    const result = await resolveEntity("pythn", alias, fuzzy);

    expect(result).toEqual({ kind: "auto", id: "skill-python", similarity: 0.75 });
  });

  it(`auto-accepts at exactly the ${AUTO_ACCEPT_THRESHOLD} boundary`, async () => {
    const alias = aliasLookup(null);
    const fuzzy = fuzzyLookup({ id: "skill-python", similarity: AUTO_ACCEPT_THRESHOLD });

    const result = await resolveEntity("pythn", alias, fuzzy);

    expect(result.kind).toBe("auto");
  });

  it("lands in review with a suggestion between 0.35 and 0.6", async () => {
    const alias = aliasLookup(null);
    const fuzzy = fuzzyLookup({ id: "skill-docker", similarity: 0.5 });

    const result = await resolveEntity("dockr container", alias, fuzzy);

    expect(result).toEqual({
      kind: "review",
      suggestedId: "skill-docker",
      similarity: 0.5,
    });
  });

  it(`lands in review with a suggestion at exactly the ${REVIEW_THRESHOLD} boundary`, async () => {
    const alias = aliasLookup(null);
    const fuzzy = fuzzyLookup({ id: "skill-docker", similarity: REVIEW_THRESHOLD });

    const result = await resolveEntity("dockr container", alias, fuzzy);

    expect(result.kind).toBe("review");
    expect((result as { suggestedId: string | null }).suggestedId).toBe("skill-docker");
  });

  it("lands in review with no suggestion below 0.35, flagging a possibly-new entry", async () => {
    const alias = aliasLookup(null);
    const fuzzy = fuzzyLookup({ id: "skill-docker", similarity: 0.2 });

    const result = await resolveEntity("underwater basket weaving", alias, fuzzy);

    expect(result).toEqual({ kind: "review", suggestedId: null, similarity: 0.2 });
  });

  it("lands in review with no suggestion when the fuzzy lookup finds nothing at all", async () => {
    const alias = aliasLookup(null);
    const fuzzy = fuzzyLookup(null);

    const result = await resolveEntity("zzz", alias, fuzzy);

    expect(result).toEqual({ kind: "review", suggestedId: null, similarity: null });
  });
});
