import { describe, expect, it } from "vitest";
import {
  finalizeSkillChips,
  mergeTagsWithSkillNames,
  type SubmittedSkillChip,
} from "./resume-parse-core";

function chip(overrides: Partial<SubmittedSkillChip>): SubmittedSkillChip {
  return {
    rawText: "TypeScript",
    currentText: "TypeScript",
    kind: "auto",
    skillId: "skill-ts",
    skillName: "TypeScript",
    similarity: 1,
    ...overrides,
  };
}

describe("finalizeSkillChips", () => {
  it("persists an untouched auto-matched chip as a confident match and confirms its name", () => {
    const { persist, confirmedNames } = finalizeSkillChips([chip({})]);

    expect(persist).toEqual([
      { rawText: "TypeScript", kind: "auto", skillId: "skill-ts", similarity: 1 },
    ]);
    expect(confirmedNames).toEqual(["TypeScript"]);
  });

  it("downgrades an EDITED auto-matched chip to review, dropping the now-untrustworthy skillId/similarity", () => {
    const { persist, confirmedNames } = finalizeSkillChips([
      chip({ currentText: "TypeScripts" }),
    ]);

    expect(persist).toEqual([
      { rawText: "TypeScripts", kind: "review", skillId: null, similarity: null },
    ]);
    expect(confirmedNames).toEqual([]);
  });

  it("keeps an unedited review chip's suggestion intact", () => {
    const { persist, confirmedNames } = finalizeSkillChips([
      chip({
        kind: "review",
        rawText: "dockr",
        currentText: "dockr",
        skillId: "skill-docker",
        skillName: "Docker",
        similarity: 0.5,
      }),
    ]);

    expect(persist).toEqual([
      { rawText: "dockr", kind: "review", skillId: "skill-docker", similarity: 0.5 },
    ]);
    // Review items never contribute to the tags mirror, matched or not —
    // only confirmed (kind "auto", unedited) skills do.
    expect(confirmedNames).toEqual([]);
  });

  it("drops the suggestion when an edited review chip's text no longer matches what was suggested", () => {
    const { persist } = finalizeSkillChips([
      chip({
        kind: "review",
        rawText: "dockr",
        currentText: "Kubernetes",
        skillId: "skill-docker",
        similarity: 0.5,
      }),
    ]);

    expect(persist).toEqual([
      { rawText: "Kubernetes", kind: "review", skillId: null, similarity: null },
    ]);
  });

  it("skips a chip whose text was edited down to empty (the user cleared it instead of removing it)", () => {
    const { persist, confirmedNames } = finalizeSkillChips([chip({ currentText: "   " })]);

    expect(persist).toEqual([]);
    expect(confirmedNames).toEqual([]);
  });

  it("treats an auto chip with no skillId as review even when unedited (defensive — shouldn't normally happen)", () => {
    const { persist } = finalizeSkillChips([chip({ skillId: null })]);

    expect(persist).toEqual([
      { rawText: "TypeScript", kind: "review", skillId: null, similarity: 1 },
    ]);
  });

  it("is case/whitespace-insensitive when deciding whether text was edited", () => {
    const { persist } = finalizeSkillChips([
      chip({ rawText: "  TypeScript  ", currentText: "typescript" }),
    ]);

    expect(persist[0].kind).toBe("auto");
  });
});

describe("mergeTagsWithSkillNames", () => {
  it("returns null when both existing tags and skill names are empty", () => {
    expect(mergeTagsWithSkillNames(null, [])).toBeNull();
    expect(mergeTagsWithSkillNames("", [])).toBeNull();
  });

  it("leaves existing tags untouched when there are no confirmed skill names", () => {
    expect(mergeTagsWithSkillNames("backend, remote", [])).toBe("backend, remote");
  });

  it("builds a tags string from skill names alone when there were no existing tags", () => {
    expect(mergeTagsWithSkillNames(null, ["TypeScript", "Docker"])).toBe("TypeScript, Docker");
  });

  it("appends skill names to existing tags, deduping case-insensitively", () => {
    expect(mergeTagsWithSkillNames("backend, TypeScript", ["TypeScript", "Docker"])).toBe(
      "backend, TypeScript, Docker"
    );
  });
});
