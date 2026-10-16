import { describe, expect, it } from "vitest";
import { CHECKER_PALETTE, checkerColors, paletteSide } from "@/lib/checkerPalette";

describe("CHECKER_PALETTE", () => {
  it("uses each side's fill as the other side's contrast color", () => {
    expect(CHECKER_PALETTE.mine.fill).toBe(CHECKER_PALETTE.opponent.contrast);
    expect(CHECKER_PALETTE.opponent.fill).toBe(CHECKER_PALETTE.mine.contrast);
  });
});

describe("swapped checker colours", () => {
  it("draws each side in its own colours by default", () => {
    expect(paletteSide("mine")).toBe("mine");
    expect(paletteSide("opponent")).toBe("opponent");
    expect(checkerColors("mine")).toBe(CHECKER_PALETTE.mine);
  });

  it("draws each side in the other side's colours when swapped", () => {
    expect(paletteSide("mine", true)).toBe("opponent");
    expect(paletteSide("opponent", true)).toBe("mine");
    expect(checkerColors("mine", true)).toBe(CHECKER_PALETTE.opponent);
    expect(checkerColors("opponent", true)).toBe(CHECKER_PALETTE.mine);
  });
});
