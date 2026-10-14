import { describe, expect, it } from "vitest";
import { formatEquity, formatLoss, formatMatchContext, formatRelativeDue, questionFor } from "@/lib/review/format";

describe("formatRelativeDue", () => {
  const now = new Date(2026, 9, 7, 15, 0);
  it("now / minutes / hours / tomorrow / days", () => {
    expect(formatRelativeDue(new Date(2026, 9, 7, 14, 0), now)).toBe("now");
    expect(formatRelativeDue(new Date(2026, 9, 7, 15, 10), now)).toBe("in 10 min");
    expect(formatRelativeDue(new Date(2026, 9, 7, 18, 0), now)).toBe("in 3 h");
    expect(formatRelativeDue(new Date(2026, 9, 8, 16, 0), now)).toBe("tomorrow");
    expect(formatRelativeDue(new Date(2026, 9, 11, 9, 0), now)).toBe("in 4 days");
  });
});

describe("formatMatchContext", () => {
  it("match play from the decision-maker's view, with Crawford", () => {
    expect(formatMatchContext({ matchLength: 5, deciderScore: 3, opponentScore: 2, crawford: "none" })).toBe(
      "5-point match · you 3 – opp 2"
    );
    expect(formatMatchContext({ matchLength: 5, deciderScore: 4, opponentScore: 2, crawford: "crawford" })).toBe(
      "5-point match · you 4 – opp 2 · Crawford"
    );
    expect(formatMatchContext({ matchLength: 7, deciderScore: 3, opponentScore: 6, crawford: "post_crawford" })).toBe(
      "7-point match · you 3 – opp 6 · post-Crawford"
    );
  });

  it("money game, and unknown", () => {
    expect(formatMatchContext({ matchLength: 0, deciderScore: null, opponentScore: null, crawford: "none" })).toBe(
      "money game"
    );
    expect(formatMatchContext(null)).toBe("");
  });
});

describe("questionFor — always second person", () => {
  it("checker, doubler, receiver", () => {
    expect(questionFor("checker")).toEqual({ lead: "Your move.", ask: "What do you play?" });
    expect(questionFor("doubler")).toEqual({ lead: "Cube action.", ask: "What do you do?" });
    expect(questionFor("receiver")).toEqual({ lead: "Opponent doubles.", ask: "Take or pass?" });
  });
});

describe("formatLoss", () => {
  it("zero, and negatives with a minus sign", () => {
    expect(formatLoss(0)).toBe("0.000");
    expect(formatLoss(-0.1829)).toBe("−0.183");
  });
});

describe("formatEquity", () => {
  it("signs non-zero values with + or a true minus (U+2212)", () => {
    expect(formatEquity(0.4123)).toBe("+0.412");
    expect(formatEquity(-0.1829)).toBe("\u2212" + "0.183");
    expect(formatEquity(1)).toBe("+1.000");
    expect(formatEquity(-1)).toBe("\u2212" + "1.000");
  });

  it("shows zero, and anything that rounds to it, unsigned", () => {
    expect(formatEquity(0)).toBe("0.000");
    expect(formatEquity(-0)).toBe("0.000");
    expect(formatEquity(-0.0004)).toBe("0.000");
    expect(formatEquity(0.0004)).toBe("0.000");
  });
});
