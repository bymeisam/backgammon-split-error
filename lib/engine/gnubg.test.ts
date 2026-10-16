import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { analyze, parseHint, parseHints } from "@/lib/engine/gnubg";

describe("parseHint", () => {
  const fixture = readFileSync(new URL("./fixtures/hint.txt", import.meta.url), "utf8");
  const mixedFixture = readFileSync(new URL("./fixtures/hint-mixed.txt", import.meta.url), "utf8");
  const singleSurvivorFixture = readFileSync(new URL("./fixtures/hint-single-survivor.txt", import.meta.url), "utf8");
  const mixedSingleSurvivorFixture = readFileSync(new URL("./fixtures/hint-single-survivor-mixed.txt", import.meta.url), "utf8");
  const narrowSingleSurvivorFixture = readFileSync(new URL("./fixtures/hint-single-survivor-narrow.txt", import.meta.url), "utf8");

  it("parses mixed-depth candidates and ignores prune detail lines", () => {
    const candidates = parseHint(mixedFixture);
    expect(candidates).toHaveLength(10);
    expect(candidates.map(({ rank, plies }) => [rank, plies])).toEqual([[1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2], [7, 2], [8, 2], [9, 0], [10, 0]]);
    expect(candidates[0].move).toBe("24/18 13/10");
    expect(candidates[0].probabilities?.win).toBe(0.506);
  });
  it("parses zero-ply diagnostic hints when explicitly requested", () => {
    expect(parseHint(fixture, 0).map(({ plies }) => plies)).toEqual(Array(7).fill(0));
  });
  it("accepts a zero-ply single survivor only when the top-two gap exceeds the filter threshold", () => {
    expect(parseHint(singleSurvivorFixture).map(({ plies }) => plies)).toEqual([0, 0]);
    expect(() => parseHint(mixedSingleSurvivorFixture)).toThrow(/best candidate was 0-ply; expected 2-ply/);
    expect(() => parseHint(narrowSingleSurvivorFixture)).toThrow(/best candidate was 0-ply; expected 2-ply/);
  });

  it("requires the best candidate to match configured depth unless it is a safe single survivor", () => {
    expect(parseHint(fixture).map(({ plies }) => plies)).toEqual(Array(7).fill(0));
    expect(() => parseHint(mixedFixture.replace("1. Cubeful 2-ply", "1. Cubeful 0-ply"))).toThrow(/best candidate was 0-ply; expected 2-ply/);
  });
  it("includes the failing batched hint and its roll index in depth errors", () => {
    expect(() => parseHints(`${mixedFixture}\n${narrowSingleSurvivorFixture}`)).toThrow(/roll index 1;.*candidates: 1:0-ply 8\/5 6\/5/);
  });

  it("expands GNU repeated-checker shorthand", () => {
    expect(parseHint("1. Cubeful 2-ply 13/7(2) Eq.: +0.123")[0].move).toBe("13/7 13/7");
  });

  it("splits batched hint output into separate roll results", () => {
    expect(parseHints(`${mixedFixture}\n${mixedFixture}`)).toHaveLength(2);
  });
  it("rejects invalid caller-supplied dice before starting Docker", async () => {
    await expect(analyze("AQAAhAAAAAAAAA", "Q4mmAAAAAAAE", [0, 1])).rejects.toThrow(/two dice from 1 to 6/);
  });

  it("returns no candidates for non-hint output", () => {
    expect(parseHint("You must set up a board first.")).toEqual([]);
  });
});
