import { describe, expect, it } from "vitest";
import {
  type CandidateForCadence,
  nextActionFor,
  statusFor,
} from "./cadence";

const DAY = 86_400_000;

function candidate(
  overrides: Partial<CandidateForCadence>
): CandidateForCadence {
  return {
    stage: "sourced",
    stage_entered_at: new Date().toISOString(),
    last_action_at: null,
    touch_index: 0,
    ...overrides,
  };
}

describe("nextActionFor", () => {
  it("returns the first touch for a freshly-entered stage", () => {
    const enteredAt = Date.now() - 5 * DAY;
    const c = candidate({
      stage: "contacted",
      stage_entered_at: new Date(enteredAt).toISOString(),
      touch_index: 0,
    });
    const action = nextActionFor(c);
    expect(action.label).toBe("Send follow-up #1");
    expect(action.script).toBe("followup1");
    expect(action.due).toBe(enteredAt + 3 * DAY);
    expect(action.terminal).toBe(false);
  });

  it("advances to the next touch by touch_index", () => {
    const enteredAt = Date.now() - 10 * DAY;
    const c = candidate({
      stage: "contacted",
      stage_entered_at: new Date(enteredAt).toISOString(),
      touch_index: 1,
    });
    const action = nextActionFor(c);
    expect(action.label).toBe("Send follow-up #2 (breakup)");
    expect(action.due).toBe(enteredAt + 8 * DAY);
  });

  it("falls through to a terminal exhausted state once touches run out and there's no recurDays", () => {
    const c = candidate({ stage: "contacted", touch_index: 2 });
    const action = nextActionFor(c);
    expect(action.terminal).toBe(true);
    expect(action.due).toBeNull();
    expect(action.script).toBeNull();
    expect(action.label).toBe(
      "No response yet — reply-check manually or archive"
    );
  });

  it("uses recurDays off last_action_at once touches are exhausted", () => {
    const enteredAt = Date.now() - 20 * DAY;
    const lastActionAt = Date.now() - 2 * DAY;
    const c = candidate({
      stage: "phone_screen",
      stage_entered_at: new Date(enteredAt).toISOString(),
      last_action_at: new Date(lastActionAt).toISOString(),
      touch_index: 2, // phone_screen has 2 touches
    });
    const action = nextActionFor(c);
    expect(action.label).toBe("Send status update (even with no news)");
    expect(action.due).toBe(lastActionAt + 6 * DAY);
    expect(action.terminal).toBe(false);
  });

  it("uses recurDays off stage_entered_at when last_action_at is null", () => {
    const enteredAt = Date.now() - 1 * DAY;
    const c = candidate({
      stage: "interviewing", // no touches at all
      stage_entered_at: new Date(enteredAt).toISOString(),
      last_action_at: null,
      touch_index: 0,
    });
    const action = nextActionFor(c);
    expect(action.due).toBe(enteredAt + 6 * DAY);
  });

  it("talent_pool has no touches and is always terminal with no due date", () => {
    const c = candidate({ stage: "talent_pool", touch_index: 0 });
    const action = nextActionFor(c);
    expect(action.terminal).toBe(true);
    expect(action.due).toBeNull();
    expect(action.label).toBe("Parked in Talent Pool");
  });

  it("a long touch schedule (onboarding) resolves the right day offset per index", () => {
    const enteredAt = Date.now() - 50 * DAY;
    const c = candidate({
      stage: "onboarding",
      stage_entered_at: new Date(enteredAt).toISOString(),
      touch_index: 4, // the 44-day "30-day check-in" touch
    });
    const action = nextActionFor(c);
    expect(action.label).toBe("30-day check-in");
    expect(action.due).toBe(enteredAt + 44 * DAY);
  });
});

describe("statusFor", () => {
  it("is always 'parked' for talent_pool, regardless of the action", () => {
    const c = candidate({ stage: "talent_pool" });
    const action = nextActionFor(c);
    expect(statusFor(c, action)).toBe("parked");
  });

  it("is 'done' for a terminal, non-talent_pool action", () => {
    const c = candidate({ stage: "contacted", touch_index: 2 });
    const action = nextActionFor(c);
    expect(statusFor(c, action)).toBe("done");
  });

  it("is 'overdue' once the due date has passed", () => {
    const c = candidate({
      stage: "sourced",
      stage_entered_at: new Date(Date.now() - 5 * DAY).toISOString(),
      touch_index: 0,
    });
    const action = nextActionFor(c);
    expect(statusFor(c, action, Date.now())).toBe("overdue");
  });

  it("is 'soon' inside the 2-day window before due", () => {
    const now = Date.now();
    const c = candidate({
      stage: "sourced",
      stage_entered_at: new Date(now + 1 * DAY).toISOString(),
      touch_index: 0,
    });
    const action = nextActionFor(c);
    expect(statusFor(c, action, now)).toBe("soon");
  });

  it("is 'ok' when due date is more than 2 days out", () => {
    const now = Date.now();
    const c = candidate({
      stage: "sourced",
      stage_entered_at: new Date(now + 5 * DAY).toISOString(),
      touch_index: 0,
    });
    const action = nextActionFor(c);
    expect(statusFor(c, action, now)).toBe("ok");
  });

  it("treats the exact due-date boundary as soon, not overdue (matches the prototype's strict due < now)", () => {
    const now = Date.now();
    const c = candidate({
      stage: "sourced",
      stage_entered_at: new Date(now).toISOString(),
      touch_index: 0,
    });
    const action = nextActionFor(c);
    expect(action.due).toBe(now);
    expect(statusFor(c, action, now)).toBe("soon");
  });
});
