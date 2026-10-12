import { describe, expect, it } from "vitest";
import { decodeGnuPositionId, encodeGnuPositionId, flipPerspective } from "@/lib/gnuPositionId";

describe("decodeGnuPositionId", () => {
  it("decodes the standard starting position correctly", () => {
    const decoded = decodeGnuPositionId("4HPwATDgc/ABMA");
    const expectedMine = new Array(24).fill(0);
    expectedMine[23] = 2; expectedMine[12] = 5; expectedMine[7] = 3; expectedMine[5] = 5;
    const expectedOpponent = new Array(24).fill(0);
    expectedOpponent[0] = 2; expectedOpponent[11] = 5; expectedOpponent[16] = 3; expectedOpponent[18] = 5;
    expect(decoded.mine).toEqual(expectedMine);
    expect(decoded.opponent).toEqual(expectedOpponent);
    expect(decoded.mineBar).toBe(0); expect(decoded.opponentBar).toBe(0);
    expect(decoded.mineOff).toBe(0); expect(decoded.opponentOff).toBe(0);
  });
  it("always accounts for exactly 15 checkers per side", () => {
    for (const id of ["4HPwATDgc/ABMA", "4PPCATDgc/ABMA", "sNsmARTYzuABMA"]) {
      const decoded = decodeGnuPositionId(id);
      expect(decoded.mine.reduce((a, b) => a + b, 0) + decoded.mineBar + decoded.mineOff).toBe(15);
      expect(decoded.opponent.reduce((a, b) => a + b, 0) + decoded.opponentBar + decoded.opponentOff).toBe(15);
    }
  });
  it("decodes known real positions", () => {
    expect(decodeGnuPositionId("4PPCATDgc/ABMA")).toEqual({ mine: [0,0,0,0,0,5,0,3,0,0,0,0,5,0,0,0,0,0,0,0,0,0,0,2], opponent: [2,0,0,0,0,0,0,0,0,0,0,3,0,0,0,1,4,0,5,0,0,0,0,0], mineBar:0, opponentBar:0, mineOff:0, opponentOff:0 });
    expect(decodeGnuPositionId("sNsmARTYzuABMA")).toEqual({ mine: [0,0,0,2,2,3,0,2,0,0,0,0,4,0,0,0,0,0,0,0,0,0,0,2], opponent: [0,1,1,0,0,0,0,0,0,0,0,1,0,1,0,2,2,2,3,2,0,0,0,0], mineBar:0, opponentBar:0, mineOff:0, opponentOff:0 });
  });
});

describe("flipPerspective", () => {
  it("swaps mine/opponent and reverses points", () => {
    const decoded = decodeGnuPositionId("4PPCATDgc/ABMA"); const flipped = flipPerspective(decoded);
    expect(flipped.mine).toEqual([...decoded.opponent].reverse()); expect(flipped.opponent).toEqual([...decoded.mine].reverse());
  });
  it("swaps bar and off counts", () => {
    const decoded = { mine: new Array(24).fill(0), opponent: new Array(24).fill(0), mineBar: 2, opponentBar: 1, mineOff: 3, opponentOff: 4 };
    const flipped = flipPerspective(decoded); expect(flipped.mineBar).toBe(1); expect(flipped.opponentBar).toBe(2); expect(flipped.mineOff).toBe(4); expect(flipped.opponentOff).toBe(3);
  });
  it("is its own inverse", () => {
    for (const id of ["4HPwATDgc/ABMA", "4PPCATDgc/ABMA", "sNsmARTYzuABMA"]) expect(flipPerspective(flipPerspective(decodeGnuPositionId(id)))).toEqual(decodeGnuPositionId(id));
  });
});

describe("encodeGnuPositionId", () => {
  it("round-trips known IDs and empty positions", () => {
    for (const id of ["4HPwATDgc/ABMA", "4PPCATDgc/ABMA", "sNsmARTYzuABMA"]) expect(encodeGnuPositionId(decodeGnuPositionId(id))).toBe(id);
    const empty = { mine: new Array(24).fill(0), opponent: new Array(24).fill(0), mineBar: 0, opponentBar: 0, mineOff: 15, opponentOff: 15 };
    expect(decodeGnuPositionId(encodeGnuPositionId(empty))).toEqual(empty);
  });
  it("rejects invalid totals", () => expect(() => encodeGnuPositionId({ mine: new Array(24).fill(0), opponent: new Array(24).fill(0), mineBar: 0, opponentBar: 0, mineOff: 14, opponentOff: 15 })).toThrow());
});
