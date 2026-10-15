import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { analyze, parseHint, parseHints } from "@/lib/engine/gnubg";

describe("parseHint", () => {
  const fixture = readFileSync(new URL("./fixtures/hint.txt", import.meta.url), "utf8");

  it("parses ranked GNU moves, equity, probabilities and standard notation", () => {
    const candidates = parseHint(fixture);
    expect(candidates).toHaveLength(7);
    expect(candidates[0]).toEqual({
      rank: 1,
      move: "8/5 6/5",
      equity: 0.2,
      probabilities: { win: 0.551, winGammon: 0.174, winBackgammon: 0.013, lose: 0.449, loseGammon: 0.124, loseBackgammon: 0.005 },
    });
    expect(candidates[1].move).toBe("24/23 13/10");
    expect(candidates[6].rank).toBe(10);
  });
  it("rejects output that does not match the configured evaluation level", () => {
    expect(() => parseHint(fixture.replaceAll("0-ply", "2-ply"))).toThrow(/expected 0-ply/);
  });
  it("expands GNU repeated-checker shorthand in standard move notation", () => {
    const candidates = parseHint("1. Cubeful 0-ply 13/7(2) Eq.: +0.123");
    expect(candidates[0].move).toBe("13/7 13/7");
  });

  it("splits batched hint output into separate roll results", () => {
    expect(parseHints(`${fixture}\n${fixture}`)).toHaveLength(2);
  });
  it("rejects invalid caller-supplied dice before starting Docker", async () => {
    await expect(analyze("AQAAhAAAAAAAAA", "Q4mmAAAAAAAE", [0, 1])).rejects.toThrow(/two dice from 1 to 6/);
  });

  it("returns no candidates for non-hint output", () => {
    expect(parseHint("You must set up a board first.")).toEqual([]);
  });
});
