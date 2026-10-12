import { describe, expect, it } from "vitest";
import {
  createCheckerExplorer,
  legalHops,
  legalHopsForDie,
  legalSequences,
  playCheckerHop,
  resetCheckerExplorer,
  undoCheckerHop,
} from "@/lib/checkerMoves";
import type { DecodedPosition } from "@/lib/gnuPositionId";

function position(overrides: Partial<DecodedPosition> = {}): DecodedPosition {
  return {
    mine: new Array(24).fill(0),
    opponent: new Array(24).fill(0),
    mineBar: 0,
    opponentBar: 0,
    mineOff: 0,
    opponentOff: 0,
    ...overrides,
  };
}

function withMine(point: number, count = 1, base = position()): DecodedPosition {
  const mine = [...base.mine];
  mine[point - 1] = count;
  return { ...base, mine };
}

function withOpponent(point: number, count: number, base = position()): DecodedPosition {
  const opponent = [...base.opponent];
  opponent[point - 1] = count;
  return { ...base, opponent };
}

describe("checker move legality", () => {
  it("moves a checker toward point 1", () => {
    const hops = legalHopsForDie(withMine(13), 4);
    expect(hops).toEqual([{ from: 13, to: 9, die: 4, hit: false }]);
  });

  it("rejects a blocked point but allows hitting a single checker", () => {
    expect(legalHopsForDie(withOpponent(9, 2, withMine(13)), 4)).toEqual([]);
    const hit = legalHopsForDie(withOpponent(9, 1, withMine(13)), 4);
    expect(hit).toEqual([{ from: 13, to: 9, die: 4, hit: true }]);
    const state = createCheckerExplorer(withOpponent(9, 1, withMine(13)), [4]);
    const after = playCheckerHop(state, hit[0]);
    expect(after.position.mine[8]).toBe(1);
    expect(after.position.opponent[8]).toBe(0);
    expect(after.position.opponentBar).toBe(1);
  });

  it("requires bar entry before any point move", () => {
    const base = withMine(13);
    const hops = legalHopsForDie({ ...base, mineBar: 1 }, 3);
    expect(hops).toEqual([{ from: "bar", to: 22, die: 3, hit: false }]);
  });

  it("expands a double to four usable dice in the explorer", () => {
    const initial = createCheckerExplorer(withMine(13, 4), [2, 2]);
    expect(initial.remainingDice).toEqual([2, 2, 2, 2]);
    const sequences = legalSequences(initial.position, initial.remainingDice);
    expect(sequences.some((sequence) => sequence.hops.length === 4)).toBe(true);
    const fourDice = createCheckerExplorer(withMine(13, 4), [2, 2, 2, 2]);
    expect(fourDice.remainingDice).toEqual([2, 2, 2, 2]);
  });

  it("uses the larger die when only one die can be played", () => {
    const sequences = legalSequences(withOpponent(1, 2, withMine(6)), [5, 6]);
    expect(sequences).toHaveLength(1);
    expect(sequences[0].hops).toEqual([{ from: 6, to: "off", die: 6, hit: false }]);
  });

  it("keeps a playable second die in every maximal sequence", () => {
    const sequences = legalSequences(withMine(8, 1, withMine(2, 1)), [6, 1]);
    expect(sequences.length).toBeGreaterThan(0);
    expect(sequences.every((sequence) => sequence.hops.length === 2)).toBe(true);
  });

  it("supports exact and oversized bear-off only when permitted", () => {
    expect(legalHopsForDie(withMine(3), 3)).toEqual([{ from: 3, to: "off", die: 3, hit: false }]);
    expect(legalHopsForDie(withMine(3), 5)).toEqual([{ from: 3, to: "off", die: 5, hit: false }]);
    expect(legalHopsForDie(withMine(3, 1, withMine(5)), 5)).toEqual([
      { from: 5, to: "off", die: 5, hit: false },
    ]);
  });

  it("refuses bear-off while a checker is outside the home board", () => {
    const hops = legalHopsForDie(withMine(13, 1, withMine(3)), 3);
    expect(hops).toEqual([{ from: 13, to: 10, die: 3, hit: false }]);
    expect(hops.some((hop) => hop.to === "off")).toBe(false);
  });

  it("allows bear-off once every checker is home", () => {
    const hops = legalHopsForDie(withMine(6, 1, withMine(3)), 3);
    expect(hops).toContainEqual({ from: 3, to: "off", die: 3, hit: false });
  });

  it("refuses bear-off while a checker is on the bar", () => {
    const hops = legalHopsForDie({ ...withMine(3), mineBar: 1 }, 3);
    expect(hops.some((hop) => hop.to === "off")).toBe(false);
  });

  it("bears off with an oversized die only from the highest occupied point", () => {
    const hops = legalHopsForDie(withMine(4, 1, withMine(2)), 6);
    expect(hops).toEqual([{ from: 4, to: "off", die: 6, hit: false }]);
  });

  it("enables bear-off with the second die after the last outside checker comes home", () => {
    const start = withMine(7, 1, withMine(2));
    expect(legalHopsForDie(start, 2).some((hop) => hop.to === "off")).toBe(false);

    const initial = createCheckerExplorer(start, [1, 2]);
    const home = playCheckerHop(initial, { from: 7, to: 6, die: 1, hit: false });
    expect(legalHops(home.position, home.remainingDice)).toContainEqual({
      from: 2,
      to: "off",
      die: 2,
      hit: false,
    });
    expect(legalSequences(start, [1, 2]).map((sequence) => sequence.notation)).toContain("7/6 2/off");
  });
});

describe("checker explorer history", () => {
  it("undoes and resets immutable positions", () => {
    const original = withMine(13);
    const initial = createCheckerExplorer(original, [4]);
    const moved = playCheckerHop(initial, legalHops(initial.position, initial.remainingDice)[0]);
    expect(undoCheckerHop(moved).position).toEqual(original);
    const reset = resetCheckerExplorer(moved);
    expect(reset.position).toEqual(original);
    expect(reset.initialPosition).toEqual(original);
    expect(initial.position).toEqual(original);
  });
});
