// Guards lib/badges.ts's two config maps against the two ways they could
// silently break: a collision (two values sharing one code, making the
// badges ambiguous at a glance) and a gap (a real value with no config
// entry, which ClassificationBadge/SeverityBadge would otherwise have to
// paper over at render time).
import { describe, expect, it } from "vitest";
import { classificationBadges, severityBadges } from "@/lib/badges";
import { ErrorSeverity } from "@/lib/generated/prisma/client";

// The 17 real classification values, confirmed live against /mistakes's
// MistakeStat-sourced filter dropdown when these badges were built (see
// PROGRESS.md's 2026-09-24 badge entries) — not derived from
// classificationBadges itself, since that would make this test tautological.
// classification is a plain string column (no DB enum backs it), so this
// list needs a manual update if Galaxy ever introduces an 18th value.
const REAL_CLASSIFICATION_VALUES = [
  "6_prime",
  "attacking_game",
  "blitz",
  "close_out",
  "crunching_game",
  "deep_anchor_game",
  "early_backgame",
  "early_blitz",
  "end_game_contact",
  "holding_game",
  "late_backgame",
  "late_game_hit",
  "middle_game",
  "mutual_holding_game",
  "one_man_back",
  "opening_game",
  "race",
];

describe("classificationBadges", () => {
  it("has exactly the 17 real classification values as keys", () => {
    expect(Object.keys(classificationBadges).sort()).toEqual([...REAL_CLASSIFICATION_VALUES].sort());
  });

  it("has a config entry for every real classification value (no missing mappings)", () => {
    for (const value of REAL_CLASSIFICATION_VALUES) {
      expect(classificationBadges).toHaveProperty(value);
      expect(classificationBadges[value].code.length).toBeGreaterThanOrEqual(2);
      expect(classificationBadges[value].code.length).toBeLessThanOrEqual(4);
    }
  });

  it("has no two classification values sharing the same code", () => {
    const codes = Object.values(classificationBadges).map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("uses a single neutral color (or none) for every classification — no per-value color coding", () => {
    const colors = new Set(Object.values(classificationBadges).map((c) => c.color));
    expect(colors.size).toBe(1);
  });
});

describe("severityBadges", () => {
  it("has a config entry for every real ErrorSeverity enum value (no missing mappings)", () => {
    for (const value of Object.values(ErrorSeverity)) {
      const key = value.toLowerCase();
      expect(severityBadges).toHaveProperty(key);
    }
  });

  it("has no two severity values sharing the same code", () => {
    const codes = Object.values(severityBadges).map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("colors blunder red and error/doubtful amber, matching MistakesSection.tsx's existing palette", () => {
    expect(severityBadges.blunder.color).toContain("red");
    expect(severityBadges.error.color).toContain("amber");
    expect(severityBadges.doubtful.color).toContain("amber");
  });
});
