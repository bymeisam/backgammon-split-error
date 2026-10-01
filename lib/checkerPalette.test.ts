import { describe, expect, it } from "vitest";
import { CHECKER_PALETTE } from "@/lib/checkerPalette";

describe("CHECKER_PALETTE", () => {
  it("uses each side's fill as the other side's contrast color", () => {
    expect(CHECKER_PALETTE.mine.fill).toBe(CHECKER_PALETTE.opponent.contrast);
    expect(CHECKER_PALETTE.opponent.fill).toBe(CHECKER_PALETTE.mine.contrast);
  });
});
