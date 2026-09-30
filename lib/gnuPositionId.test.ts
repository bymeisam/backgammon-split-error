// The ask for these tests named match 33599869 as the source of known-good
// Position IDs — that match ID doesn't appear anywhere in this project's
// code, docs, or PROGRESS.md history, so nothing about it could be
// reconstructed. Substituted match 46576635 instead (real data already
// fetched and used earlier this session, for the /mistakes dice-roll work)
// — see the "real match data" describe block below.
import { describe, expect, it } from "vitest";
import { decodeGnuPositionId, flipPerspective } from "@/lib/gnuPositionId";

describe("decodeGnuPositionId", () => {
  // The standard backgammon starting position — a fixed, universally known
  // GNU Backgammon Position ID, independent of any specific match. Ground
  // truth here isn't "whatever the code currently outputs" (that would only
  // catch accidental future changes, not an existing bug) — it's the
  // textbook starting layout: 2 checkers on the 24-point, 5 on the 13-point,
  // 3 on the 8-point, 5 on the 6-point, mirrored for both sides, nothing on
  // the bar or borne off.
  it("decodes the standard starting position correctly", () => {
    const decoded = decodeGnuPositionId("4HPwATDgc/ABMA");

    // "mine" is in the mover's own frame: 2/13/3/5 checkers on their
    // 24/13/8/6 points.
    const expectedMine = new Array(24).fill(0);
    expectedMine[23] = 2; // 24-point
    expectedMine[12] = 5; // 13-point
    expectedMine[7] = 3; // 8-point
    expectedMine[5] = 5; // 6-point

    // "opponent" is remapped into the SAME mover's-frame numbering
    // (point = 25 - their own point), matching real board geometry: each
    // side's back checkers sit on physically opposite points, not the same
    // index — opponent's 24-point (their back checkers) lands at the
    // mover's point 1, not point 24.
    const expectedOpponent = new Array(24).fill(0);
    expectedOpponent[0] = 2; // their 24-point -> mover's point 1
    expectedOpponent[11] = 5; // their 13-point -> mover's point 12
    expectedOpponent[16] = 3; // their 8-point -> mover's point 17
    expectedOpponent[18] = 5; // their 6-point -> mover's point 19

    expect(decoded.mine).toEqual(expectedMine);
    expect(decoded.opponent).toEqual(expectedOpponent);
    expect(decoded.mineBar).toBe(0);
    expect(decoded.opponentBar).toBe(0);
    expect(decoded.mineOff).toBe(0);
    expect(decoded.opponentOff).toBe(0);
  });

  it("always accounts for exactly 15 checkers per side (on points + bar + off)", () => {
    for (const id of ["4HPwATDgc/ABMA", "4PPCATDgc/ABMA", "sNsmARTYzuABMA"]) {
      const decoded = decodeGnuPositionId(id);
      const mineTotal =
        decoded.mine.reduce((a, b) => a + b, 0) + decoded.mineBar + decoded.mineOff;
      const opponentTotal =
        decoded.opponent.reduce((a, b) => a + b, 0) + decoded.opponentBar + decoded.opponentOff;
      expect(mineTotal).toBe(15);
      expect(opponentTotal).toBe(15);
    }
  });

  // Real Position IDs from match 46576635, game 1 (source/destination
  // position of the same opening_game decision — see PROGRESS.md's
  // 2026-09-24 dice-roll entries). Pinned against the decoder's own
  // currently-correct output (cross-checked above for internal consistency
  // — 15 checkers per side) rather than an independently-reconstructed
  // ground truth, since these two positions are a couple of moves into a
  // real game, not a well-known fixed layout like the starting position —
  // this is a regression pin: a future decoder change that silently shifts
  // a point mapping will fail this immediately.
  describe("real match data (match 46576635, game 1)", () => {
    it("decodes the opening decision's source position", () => {
      const decoded = decodeGnuPositionId("4PPCATDgc/ABMA");
      expect(decoded).toEqual({
        mine: [0, 0, 0, 0, 0, 5, 0, 3, 0, 0, 0, 0, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2],
        opponent: [2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 0, 0, 0, 1, 4, 0, 5, 0, 0, 0, 0, 0],
        mineBar: 0,
        opponentBar: 0,
        mineOff: 0,
        opponentOff: 0,
      });
    });

    it("decodes the opening decision's destination position", () => {
      const decoded = decodeGnuPositionId("sNsmARTYzuABMA");
      expect(decoded).toEqual({
        mine: [0, 0, 0, 2, 2, 3, 0, 2, 0, 0, 0, 0, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2],
        opponent: [0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 2, 2, 2, 3, 2, 0, 0, 0, 0],
        mineBar: 0,
        opponentBar: 0,
        mineOff: 0,
        opponentOff: 0,
      });
    });
  });
});

describe("flipPerspective", () => {
  // Same relationship decodeGnuPositionId already relies on internally
  // (board[0][24 - point]) applied once more to its own finished output:
  // mine/opponent trade roles, and each 24-array is index-reversed (point N
  // <-> physical point 25-N). For a plain 0-indexed 24-array, "index i reads
  // from 23-i of the other array" is exactly array.reverse() — asserted
  // directly against the real decoded arrays rather than hand-typing a
  // second 24-element fixture that could itself have a transcription bug.
  it("swaps mine/opponent and index-reverses both 24-point arrays", () => {
    const decoded = decodeGnuPositionId("4PPCATDgc/ABMA"); // real match 46576635 data, see above
    const flipped = flipPerspective(decoded);

    expect(flipped.mine).toEqual([...decoded.opponent].reverse());
    expect(flipped.opponent).toEqual([...decoded.mine].reverse());
  });

  it("swaps bar and off counts", () => {
    // Any position with distinct, nonzero bar/off counts on both sides
    // exercises this precisely — the starting position (all zero) wouldn't.
    const decoded = {
      mine: new Array(24).fill(0),
      opponent: new Array(24).fill(0),
      mineBar: 2,
      opponentBar: 1,
      mineOff: 3,
      opponentOff: 4,
    };
    const flipped = flipPerspective(decoded);

    expect(flipped.mineBar).toBe(1);
    expect(flipped.opponentBar).toBe(2);
    expect(flipped.mineOff).toBe(4);
    expect(flipped.opponentOff).toBe(3);
  });

  it("is its own inverse (flipping twice returns the original)", () => {
    for (const id of ["4HPwATDgc/ABMA", "4PPCATDgc/ABMA", "sNsmARTYzuABMA"]) {
      const decoded = decodeGnuPositionId(id);
      expect(flipPerspective(flipPerspective(decoded))).toEqual(decoded);
    }
  });

  it("still accounts for exactly 15 checkers per side after flipping", () => {
    for (const id of ["4HPwATDgc/ABMA", "4PPCATDgc/ABMA", "sNsmARTYzuABMA"]) {
      const flipped = flipPerspective(decodeGnuPositionId(id));
      const mineTotal =
        flipped.mine.reduce((a, b) => a + b, 0) + flipped.mineBar + flipped.mineOff;
      const opponentTotal =
        flipped.opponent.reduce((a, b) => a + b, 0) + flipped.opponentBar + flipped.opponentOff;
      expect(mineTotal).toBe(15);
      expect(opponentTotal).toBe(15);
    }
  });
});
