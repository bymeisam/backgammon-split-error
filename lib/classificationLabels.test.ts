import { describe, expect, it } from "vitest";
import {
  CLASSIFICATION_LABELS_BY_RAW_VALUE,
  getClassificationLabel,
  getPhaseLabel,
  phaseOptionsFor,
} from "@/lib/classificationLabels";

describe("CLASSIFICATION_LABELS_BY_RAW_VALUE — Galaxy's names", () => {
  it("maps every stored key to Galaxy's display name, in Galaxy's order", () => {
    expect(Object.entries(CLASSIFICATION_LABELS_BY_RAW_VALUE)).toEqual([
      ["opening_game", "Opening game"],
      ["middle_game", "Middle game"],
      ["race", "Race"],
      ["early_blitz", "Blitz, early"],
      ["blitz", "Blitz, middle and late"],
      ["attacking_game", "Attacking game"],
      ["mutual_holding_game", "Mutual holding game"],
      ["one_man_back", "One man back"],
      ["holding_game", "Holding game"],
      ["deep_anchor_game", "Deep anchor game"],
      ["end_game_contact", "Endgame contact"],
      ["crunching_game", "Crunching game"],
      ["6_prime", "6 prime"],
      ["early_backgame", "Backgame, early"],
      ["late_backgame", "Backgame, late"],
      ["late_game_hit", "Late game hit"],
      ["close_out", "Close out"],
    ]);
  });
});

describe("phaseOptionsFor", () => {
  it("keeps our own ply buckets' labels first, then Galaxy's names in Galaxy's order, unknown keys last", () => {
    const options = phaseOptionsFor(["race", "new_phase", "6_prime", "opening_game", "early_blitz", "close_out"]);
    expect(options.map((o) => o.label)).toEqual([
      "Opening (both plies)",
      "1st roll",
      "1st roll – response",
      "2nd roll",
      "2nd roll – response",
      "Race",
      "Blitz, early",
      "6 prime",
      "Close out",
      "new_phase",
    ]);
  });
});

describe("getClassificationLabel", () => {
  it("returns the mapped label for every known classification", () => {
    for (const [value, label] of Object.entries(CLASSIFICATION_LABELS_BY_RAW_VALUE)) {
      expect(getClassificationLabel(value)).toBe(label);
    }
  });

  it("falls back to the raw value for a classification Galaxy adds later", () => {
    expect(getClassificationLabel("new_phase")).toBe("new_phase");
  });

  it("doesn't resolve inherited object properties as labels", () => {
    for (const name of ["toString", "constructor", "hasOwnProperty", "__proto__"]) {
      expect(getClassificationLabel(name)).toBe(name);
    }
  });
});

describe("getPhaseLabel", () => {
  it("prefers a fixed phase option's label over the classification label", () => {
    expect(getPhaseLabel("opening_game")).toBe("Opening (both plies)");
    expect(getPhaseLabel("ply_3")).toBe("2nd roll");
  });

  it("falls through to the classification label, then the raw value", () => {
    expect(getPhaseLabel("race")).toBe("Race");
    expect(getPhaseLabel("blitz")).toBe("Blitz, middle and late");
    expect(getPhaseLabel("new_phase")).toBe("new_phase");
  });

  // ?phase= comes straight from the URL on /mistakes and /repeated-positions
  // and lands in the visible "N <filter> decisions" line.
  it("returns the raw string for a URL value naming an Object.prototype member", () => {
    expect(getPhaseLabel("toString")).toBe("toString");
  });
});
