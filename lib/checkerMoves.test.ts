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

  it("uses four copies of a double when four checkers can move", () => {
    const sequences = legalSequences(withMine(13, 4), [2, 2]);
    expect(sequences.length).toBeGreaterThan(0);
    expect(sequences.every((sequence) => sequence.hops.length === 2)).toBe(true);
    const fourDice = legalSequences(withMine(13, 4), [2, 2, 2, 2]);
    expect(fourDice.some((sequence) => sequence.hops.length === 4)).toBe(true);
  });

  it("uses the larger die when only one die can be played", () => {
    const sequences = legalSequences(withMine(6), [5, 6]);
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
    expect(legalHopsForDie(withMine(3, 1, withMine(5)), 5)).toEqual([]);
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
