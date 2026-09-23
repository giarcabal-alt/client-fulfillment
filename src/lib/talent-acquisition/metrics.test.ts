import { describe, expect, it } from "vitest";
import {
  computeDeclineReasonBreakdown,
  computeTimeInStage,
  parseStageFromHistoryLabel,
} from "./metrics";

describe("parseStageFromHistoryLabel", () => {
  it("extracts the stage from a well-formed label", () => {
    expect(parseStageFromHistoryLabel("Moved to phone_screen")).toBe(
      "phone_screen"
    );
  });

  it("returns null for a label that doesn't match the writer's format", () => {
    expect(parseStageFromHistoryLabel("Something else entirely")).toBeNull();
  });
});

describe("computeTimeInStage", () => {
  it("attributes the interval between two consecutive moves to the first stage", () => {
    const stats = computeTimeInStage([
      { candidateId: "c1", stage: "sourced", occurredAt: "2026-01-01T00:00:00Z" },
      { candidateId: "c1", stage: "contacted", occurredAt: "2026-01-04T00:00:00Z" },
    ]);

    expect(stats).toEqual([{ stage: "sourced", avgDays: 3, transitionCount: 1 }]);
  });

  it("excludes the candidate's current (last, open-ended) stage from the calculation", () => {
    const stats = computeTimeInStage([
      { candidateId: "c1", stage: "sourced", occurredAt: "2026-01-01T00:00:00Z" },
      { candidateId: "c1", stage: "contacted", occurredAt: "2026-01-04T00:00:00Z" },
      // No event after this — "contacted" is still open-ended and must
      // not appear in the output at all.
    ]);

    expect(stats.find((s) => s.stage === "contacted")).toBeUndefined();
    expect(stats).toEqual([{ stage: "sourced", avgDays: 3, transitionCount: 1 }]);
  });

  it("never attributes anything to a candidate's creation-time stage (no event marks entering it)", () => {
    // Only one move ever recorded — the interval before it (whatever stage
    // the candidate started in) is unrepresented in candidate_history at
    // all, and the interval after it is the current, open-ended stage.
    const stats = computeTimeInStage([
      { candidateId: "c1", stage: "phone_screen", occurredAt: "2026-01-10T00:00:00Z" },
    ]);

    expect(stats).toEqual([]);
  });

  it("averages across multiple candidates that passed through the same stage", () => {
    const stats = computeTimeInStage([
      { candidateId: "c1", stage: "sourced", occurredAt: "2026-01-01T00:00:00Z" },
      { candidateId: "c1", stage: "contacted", occurredAt: "2026-01-03T00:00:00Z" }, // 2 days
      { candidateId: "c2", stage: "sourced", occurredAt: "2026-01-01T00:00:00Z" },
      { candidateId: "c2", stage: "contacted", occurredAt: "2026-01-05T00:00:00Z" }, // 4 days
    ]);

    expect(stats).toEqual([{ stage: "sourced", avgDays: 3, transitionCount: 2 }]);
  });

  it("counts a candidate bouncing back into a stage as a second completed transition", () => {
    const stats = computeTimeInStage([
      { candidateId: "c1", stage: "sourced", occurredAt: "2026-01-01T00:00:00Z" },
      { candidateId: "c1", stage: "contacted", occurredAt: "2026-01-02T00:00:00Z" }, // sourced: 1 day
      { candidateId: "c1", stage: "sourced", occurredAt: "2026-01-05T00:00:00Z" }, // contacted: 3 days
      { candidateId: "c1", stage: "contacted", occurredAt: "2026-01-06T00:00:00Z" }, // sourced: 1 day
    ]);

    const sourced = stats.find((s) => s.stage === "sourced");
    expect(sourced).toEqual({ stage: "sourced", avgDays: 1, transitionCount: 2 });
  });

  it("returns an empty array when there's no data at all", () => {
    expect(computeTimeInStage([])).toEqual([]);
  });
});

describe("computeDeclineReasonBreakdown", () => {
  it("groups reasons case-insensitively and sorts by frequency descending", () => {
    const stats = computeDeclineReasonBreakdown([
      "Culture fit",
      "culture fit",
      "Compensation",
      "CULTURE FIT",
      "Compensation",
      "Location mismatch",
    ]);

    expect(stats).toEqual([
      { reason: "Culture fit", count: 3 },
      { reason: "Compensation", count: 2 },
      { reason: "Location mismatch", count: 1 },
    ]);
  });

  it("ignores null and blank reasons", () => {
    const stats = computeDeclineReasonBreakdown(["Compensation", null, "  ", ""]);
    expect(stats).toEqual([{ reason: "Compensation", count: 1 }]);
  });

  it("returns an empty array when there are no decline reasons yet", () => {
    expect(computeDeclineReasonBreakdown([])).toEqual([]);
  });
});
