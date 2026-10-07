import { describe, expect, it } from "vitest";
import { isReviewEligible, reviewEligibility } from "@/lib/review/eligibility";
import examples from "@/lib/__fixtures__/analysis/galaxy-analysis-examples.json";
import forcedMove from "@/lib/__fixtures__/galaxy-payloads/forced-move-not-counted.json";

type Example = { decisionId: number; analysedEvent: string; raw: unknown };
const ex = examples as unknown as Record<string, Example>;

const base = { countAsDecision: true, rawError: -0.1, source: "galaxy" } as const;

describe("reviewEligibility", () => {
  it("a counted checker move with several candidates is eligible (C1, E1, F1)", () => {
    for (const name of ["C1", "E1", "F1"]) {
      const r = reviewEligibility({ ...base, kind: "CHECKER", raw: ex[name].raw });
      expect(r.eligible).toBe(true);
    }
  });

  it("counted cube decisions are eligible, doubler and receiver (629849, 666976, 652116)", () => {
    for (const name of ["cubeDouble", "cubePassNegated", "cubePassNotNegated"]) {
      expect(isReviewEligible({ ...base, kind: "CUBE", raw: ex[name].raw })).toBe(true);
    }
  });

  it("any player's decision qualifies (no user filter in the rule at all)", () => {
    // The rule takes no userId: an opponent's decision is judged the same.
    expect(isReviewEligible({ ...base, kind: "CHECKER", raw: ex.C1.raw })).toBe(true);
  });

  it("not counted: countAsDecision false, or rawError null", () => {
    expect(reviewEligibility({ ...base, kind: "CHECKER", countAsDecision: false, raw: ex.C1.raw })).toEqual({
      eligible: false,
      reason: "not-counted",
    });
    expect(reviewEligibility({ ...base, kind: "CHECKER", rawError: null, raw: ex.C1.raw })).toEqual({
      eligible: false,
      reason: "not-counted",
    });
  });

  it("resignations are never eligible", () => {
    expect(reviewEligibility({ ...base, kind: "RESIGNATION", raw: ex.resignation.raw })).toEqual({
      eligible: false,
      reason: "resignation",
    });
  });

  it("a source without a translator isn't eligible, even with a readable payload", () => {
    expect(reviewEligibility({ ...base, kind: "CHECKER", source: "xg", raw: ex.C1.raw })).toEqual({
      eligible: false,
      reason: "no-translator",
    });
  });

  it("no analysis (unreadable payload, or the kind doesn't match the analysis)", () => {
    expect(reviewEligibility({ ...base, kind: "CHECKER", raw: { reviews: [] } }).eligible).toBe(false);
    expect(reviewEligibility({ ...base, kind: "CUBE", raw: ex.C1.raw })).toEqual({ eligible: false, reason: "no-analysis" });
    expect(reviewEligibility({ ...base, kind: "CHECKER", raw: ex.cubeDouble.raw })).toEqual({
      eligible: false,
      reason: "no-analysis",
    });
  });

  it("a forced move (a single candidate) isn't eligible, even if it were counted", () => {
    const raw = forcedMove.data.events[0];
    // As stored: not counted.
    expect(reviewEligibility({ ...base, kind: "CHECKER", countAsDecision: false, raw }).eligible).toBe(false);
    // And even counted, one candidate means nothing to choose.
    expect(reviewEligibility({ ...base, kind: "CHECKER", raw })).toEqual({ eligible: false, reason: "forced-move" });
  });
});
