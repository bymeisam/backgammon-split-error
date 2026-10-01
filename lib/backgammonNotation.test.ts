import { describe, expect, it } from "vitest";
import { parseNotation, mirrorSubMoves } from "@/lib/backgammonNotation";

describe("parseNotation — simple (1-hop) moves, unchanged behavior", () => {
  it("parses a plain move", () => {
    expect(parseNotation("13/9")).toEqual([{ from: 13, to: 9, hit: false, count: 1 }]);
  });

  it("parses a hit", () => {
    expect(parseNotation("9/4*")).toEqual([{ from: 9, to: 4, hit: true, count: 1 }]);
  });

  it("parses a repeated move with a count suffix", () => {
    expect(parseNotation("13/7(3)")).toEqual([{ from: 13, to: 7, hit: false, count: 3 }]);
  });

  it("parses bar entry and bearing off", () => {
    expect(parseNotation("bar/22")).toEqual([{ from: "bar", to: 22, hit: false, count: 1 }]);
    expect(parseNotation("5/off")).toEqual([{ from: 5, to: "off", hit: false, count: 1 }]);
  });

  it("parses multiple space-delimited moves", () => {
    expect(parseNotation("24/23 13/9")).toEqual([
      { from: 24, to: 23, hit: false, count: 1 },
      { from: 13, to: 9, hit: false, count: 1 },
    ]);
  });

  it("drops a nonsensical from:off or to:bar move rather than producing one", () => {
    expect(parseNotation("off/6")).toEqual([]);
    expect(parseNotation("6/bar")).toEqual([]);
  });

  it("ignores unparseable tokens", () => {
    expect(parseNotation("not-a-move")).toEqual([]);
    expect(parseNotation("")).toEqual([]);
  });
});

// Chained compact notation ("13/10*/6", one checker's whole move for the
// roll written as a single slash-chain) used to match the single-hop regex
// right up until a second "/" appeared, at which point the regex failed to
// match the *entire* token and it was silently dropped — not merged into
// one long arrow, not split, just gone, with no arrow drawn for either hop.
// Confirmed against real decision 655340 (match 32807941, game 2): before
// this fix, parseNotation("9/5*/2") returned [], and the replay board
// showed zero arrows despite a real two-hop hitting move having been
// played. See PROGRESS.md, 2026-10-01, for the full investigation
// (including the ~1.55%-of-CHECKER-decisions real-data frequency check).
describe("parseNotation — chained (multi-hop) moves", () => {
  it("splits a 2-hop chain into two independently-anchored sub-moves, hit on only one hop", () => {
    // Real decision 655340's own notation (match 32807941, game 2) — the
    // exact case the original investigation found silently dropped.
    expect(parseNotation("9/5*/2")).toEqual([
      { from: 9, to: 5, hit: true, count: 1 },
      { from: 5, to: 2, hit: false, count: 1 },
    ]);
  });

  it("splits a 2-hop chain with no hits at all", () => {
    expect(parseNotation("13/10/6")).toEqual([
      { from: 13, to: 10, hit: false, count: 1 },
      { from: 10, to: 6, hit: false, count: 1 },
    ]);
  });

  it("gives each hop its own independent hit flag, not one flag for the whole chain", () => {
    // Real data: a double-hit chain, one hit per landing point.
    expect(parseNotation("17/15*/10*")).toEqual([
      { from: 17, to: 15, hit: true, count: 1 },
      { from: 15, to: 10, hit: true, count: 1 },
    ]);
  });

  it("splits a real 3-hop (4-point) chain", () => {
    // Real data (decision id 1038351): a checker hit at every one of its 3
    // landing points on its way from 24 to 8.
    expect(parseNotation("24/16*/12*/8*")).toEqual([
      { from: 24, to: 16, hit: true, count: 1 },
      { from: 16, to: 12, hit: true, count: 1 },
      { from: 12, to: 8, hit: true, count: 1 },
    ]);
  });

  it("splits a real 4-hop (5-point) chain starting from the bar", () => {
    // Real data (decision id 1106206) — the longest chain found in the
    // whole dataset (every other 4-point+ chain tops out at 3 hops), and
    // it enters from the bar: exercises both the "arbitrary chain length"
    // requirement and the bar's own distinct from-geometry in one case.
    expect(parseNotation("bar/20*/15*/10*/5")).toEqual([
      { from: "bar", to: 20, hit: true, count: 1 },
      { from: 20, to: 15, hit: true, count: 1 },
      { from: 15, to: 10, hit: true, count: 1 },
      { from: 10, to: 5, hit: false, count: 1 },
    ]);
  });

  it("applies a trailing (count) to every hop, not just the last one", () => {
    // Real-shaped case: "two checkers, each made the whole 5/4*/3 chain" —
    // represented as 2 ParsedSubMoves (one per hop), each carrying count: 2,
    // the same "count field on one entry" convention a plain repeated
    // single move already uses ("13/7(3)" above), rather than 4 separate
    // duplicate hop entries. Board.tsx already draws one "xN" label per
    // subMove, so this renders as two arrows, each labeled x2.
    expect(parseNotation("5/4*/3(2)")).toEqual([
      { from: 5, to: 4, hit: true, count: 2 },
      { from: 4, to: 3, hit: false, count: 2 },
    ]);
  });

  it("parses a chain starting from the bar with hits at every hop", () => {
    expect(parseNotation("bar/21*/18*")).toEqual([
      { from: "bar", to: 21, hit: true, count: 1 },
      { from: 21, to: 18, hit: true, count: 1 },
    ]);
  });

  it("parses a bar-starting chain with no hits", () => {
    expect(parseNotation("bar/22/18")).toEqual([
      { from: "bar", to: 22, hit: false, count: 1 },
      { from: 22, to: 18, hit: false, count: 1 },
    ]);
  });

  it("parses a chained token alongside a normal space-delimited token in the same notation", () => {
    expect(parseNotation("24/18 13/10*/6")).toEqual([
      { from: 24, to: 18, hit: false, count: 1 },
      { from: 13, to: 10, hit: true, count: 1 },
      { from: 10, to: 6, hit: false, count: 1 },
    ]);
    // Order independence — the chain first, simple move second, matches
    // the plain concatenation order either way.
    expect(parseNotation("13/10*/6 24/18")).toEqual([
      { from: 13, to: 10, hit: true, count: 1 },
      { from: 10, to: 6, hit: false, count: 1 },
      { from: 24, to: 18, hit: false, count: 1 },
    ]);
  });
});

describe("mirrorSubMoves — unaffected by chain parsing (flat ParsedSubMove[] in, same shape out)", () => {
  it("mirrors every hop of a parsed chain independently", () => {
    const parsed = parseNotation("9/5*/2");
    expect(mirrorSubMoves(parsed)).toEqual([
      { from: 16, to: 20, hit: true, count: 1 },
      { from: 20, to: 23, hit: false, count: 1 },
    ]);
  });

  it("leaves bar untouched on a mirrored bar-starting chain", () => {
    const parsed = parseNotation("bar/21*/18*");
    expect(mirrorSubMoves(parsed)).toEqual([
      { from: "bar", to: 4, hit: true, count: 1 },
      { from: 4, to: 7, hit: true, count: 1 },
    ]);
  });
});
