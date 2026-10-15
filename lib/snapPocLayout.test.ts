import { describe, expect, it } from "vitest";
import { snapCheckerTotals, validateSnapLayout } from "@/lib/snapPocLayout";

function emptyRow() {
  return Array.from({ length: 12 }, () => ({ color: "none", count: 0 }));
}

function validLayout() {
  const topRow = emptyRow();
  const bottomRow = emptyRow();
  topRow[0] = { color: "dark", count: 5 };
  bottomRow[11] = { color: "light", count: 2 };
  return {
    topRow,
    bottomRow,
    bar: { light: 1, dark: 0 },
    borneOff: { light: 0, dark: 3 },
    dice: [3, 5],
    cube: { visible: true, value: 1, location: "center" },
    barSide: "middle",
    confidence: "high",
    notes: "",
  };
}

describe("validateSnapLayout", () => {
  it("accepts a well-formed layout", () => {
    const result = validateSnapLayout(validLayout());
    expect(result.ok).toBe(true);
    if (result.ok) expect(snapCheckerTotals(result.layout)).toEqual({ light: 3, dark: 8 });
  });

  it("accepts no dice", () => {
    expect(validateSnapLayout({ ...validLayout(), dice: [] }).ok).toBe(true);
  });

  it("rejects a row without 12 entries", () => {
    const layout = validLayout();
    layout.topRow.pop();
    const result = validateSnapLayout(layout);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContain("topRow has 11 entries, expected 12");
  });

  it("rejects negative or fractional counts", () => {
    const layout = validLayout();
    layout.bottomRow[0] = { color: "light", count: -1 };
    layout.bottomRow[1] = { color: "light", count: 1.5 };
    const result = validateSnapLayout({ ...layout, bar: { light: -2, dark: 0 } });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toEqual([
        "bottomRow[0].count is not a non-negative integer",
        "bottomRow[1].count is not a non-negative integer",
        "bar.light is not a non-negative integer",
      ]);
    }
  });

  it("rejects bad dice and unknown enum values", () => {
    const result = validateSnapLayout({ ...validLayout(), dice: [0, 7, 2], confidence: "sure" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toEqual([
        "dice has 3 entries, expected 0-2",
        "dice[0] is not 1-6",
        "dice[1] is not 1-6",
        "confidence is invalid",
      ]);
    }
  });

  it("rejects a non-object", () => {
    expect(validateSnapLayout(null)).toEqual({ ok: false, errors: ["layout is not an object"] });
  });
});
