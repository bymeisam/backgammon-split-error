import { describe, expect, it } from "vitest";
import {
  CLASSIFICATION_LABELS_BY_RAW_VALUE,
  getClassificationLabel,
  getPhaseLabel,
} from "@/lib/classificationLabels";

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
    expect(getPhaseLabel("new_phase")).toBe("new_phase");
  });

  // ?phase= comes straight from the URL on /mistakes and /repeated-positions
  // and lands in the visible "N <filter> decisions" line.
  it("returns the raw string for a URL value naming an Object.prototype member", () => {
    expect(getPhaseLabel("toString")).toBe("toString");
  });
});
