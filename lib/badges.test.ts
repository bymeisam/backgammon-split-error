// Guards lib/badges.ts's two config maps against the two ways they could
// silently break: a collision (two values sharing one code, making the
// badges ambiguous at a glance) and a gap (a real value with no config
// entry, which ClassificationBadge/SeverityBadge would otherwise have to
// paper over at render time).
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { THEMES } from "@/lib/themes";
import {
  badgeForClassification,
  badgeForSeverity,
  classificationBadges,
  playedMoveTier,
  severityBadges,
  severityLabel,
  severityTier,
  type SeverityTier,
} from "@/lib/badges";
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
  it("has a config entry for every tier", () => {
    for (const tier of ["best", "good", "error", "blunder"] as SeverityTier[]) {
      expect(severityBadges).toHaveProperty(tier);
    }
  });

  it("shows Galaxy's names: Best, Good, Error, Blunder", () => {
    expect(severityBadges.best.code).toBe("Best");
    expect(severityBadges.good.code).toBe("Good");
    expect(severityBadges.error.code).toBe("Error");
    expect(severityBadges.blunder.code).toBe("Blunder");
  });

  it("has no two tiers sharing the same code", () => {
    const codes = Object.values(severityBadges).map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  // The badges fill with the severity tokens, and every theme sets those
  // to Galaxy's own hues.
  it("uses Galaxy's colours", () => {
    const galaxy = { best: "#36d399", good: "#65758b", error: "#fbbd23", blunder: "#f43e5c" } as const;
    for (const theme of THEMES) {
      const css = readFileSync(path.resolve(__dirname, `../app/themes/${theme.id}.css`), "utf8").toLowerCase();
      for (const [tier, hex] of Object.entries(galaxy)) {
        expect(severityBadges[tier as SeverityTier].color).toContain(`bg-${tier}`);
        expect(css).toContain(`--${tier}: ${hex};`);
      }
    }
  });
});

describe("severityTier / severityLabel", () => {
  it("maps every ErrorSeverity enum value to Galaxy's tier — DOUBTFUL is Good, not an error", () => {
    expect(severityTier(ErrorSeverity.NONE)).toBe("best");
    expect(severityTier(ErrorSeverity.DOUBTFUL)).toBe("good");
    expect(severityTier(ErrorSeverity.ERROR)).toBe("error");
    expect(severityTier(ErrorSeverity.BLUNDER)).toBe("blunder");
    for (const value of Object.values(ErrorSeverity)) {
      expect(severityBadges).toHaveProperty(severityTier(value));
    }
  });

  it("names each stored value", () => {
    expect(severityLabel(ErrorSeverity.NONE)).toBe("Best");
    expect(severityLabel(ErrorSeverity.DOUBTFUL)).toBe("Good");
    expect(severityLabel(ErrorSeverity.ERROR)).toBe("Error");
    expect(severityLabel(ErrorSeverity.BLUNDER)).toBe("Blunder");
  });
});

describe("badgeForSeverity", () => {
  it("returns the mapped config for every known tier", () => {
    for (const key of Object.keys(severityBadges) as SeverityTier[]) {
      expect(badgeForSeverity(key)).toBe(severityBadges[key]);
    }
  });

  it("falls back to the raw value instead of undefined for an unmapped key", () => {
    // Only reachable by bypassing the type (a cast or untyped JSON) — this
    // used to return undefined and make Badge throw on config.label.
    expect(badgeForSeverity("bogus" as SeverityTier)).toEqual({ code: "bogus", label: "bogus" });
  });
});

describe("badgeForClassification", () => {
  it("returns the mapped config for every real classification value", () => {
    for (const value of REAL_CLASSIFICATION_VALUES) {
      expect(badgeForClassification(value)).toBe(classificationBadges[value]);
    }
  });

  it("falls back to the raw value for a classification Galaxy adds later", () => {
    expect(badgeForClassification("new_phase")).toEqual({ code: "new_phase", label: "new_phase" });
  });

  it("doesn't resolve inherited object properties as configs", () => {
    expect(badgeForClassification("toString")).toEqual({ code: "toString", label: "toString" });
  });
});

describe("playedMoveTier", () => {
  it("shows a blunder and a good move as themselves, anything else as an error", () => {
    expect(playedMoveTier("blunder")).toBe("blunder");
    expect(playedMoveTier("good")).toBe("good");
    expect(playedMoveTier("error")).toBe("error");
    expect(playedMoveTier(null)).toBe("error");
  });
});
