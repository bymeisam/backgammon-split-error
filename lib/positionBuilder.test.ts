import { describe, expect, it } from "vitest";
import { decodeGnuMatchId } from "./gnuMatchId";
import { decodeGnuPositionId, flipPerspective } from "./gnuPositionId";
import { pipCounts } from "./pipCount";
import {
  canonicalPositionForForum,
  editChecker,
  emptyPosition,
  initialPositionBuilderState,
  checkerTotal,
  normalizeRoll,
  startingPosition,
  validateBuilderState,
  type PositionBuilderState,
} from "./positionBuilder";

describe("position builder state", () => {
  it("creates a legal standard starting position", () => {
    const position = startingPosition();
    expect(checkerTotal(position, "mine")).toBe(15);
    expect(checkerTotal(position, "opponent")).toBe(15);
    expect(position.mine[23]).toBe(2);
    expect(position.opponent[0]).toBe(2);
    expect(initialPositionBuilderState().roll).toEqual([1, 1]);
    expect(initialPositionBuilderState().decisionType).toBe("checker");
  });

  it("normalizes a boundary roll to higher die first", () => {
    expect(normalizeRoll([2, 6])).toEqual([6, 2]);
  });

  it("places and removes checkers while preserving each side's total", () => {
    const position = emptyPosition();
    const placed = editChecker(position, "mine", "add", 1);
    expect(placed.error).toBeNull();
    expect(placed.position?.mine[0]).toBe(1);
    expect(placed.position && checkerTotal(placed.position, "mine")).toBe(15);

    const removed = editChecker(placed.position!, "mine", "remove", 1);
    expect(removed.error).toBeNull();
    expect(removed.position).toEqual(position);
  });

  it("rejects placing onto a point occupied by the other side", () => {
    const position = emptyPosition();
    position.opponent[1] = 1;
    position.opponentOff = 14;
    const result = editChecker(position, "mine", "add", 2);
    expect(result.position).toBeNull();
    expect(result.error).toContain("both sides");
  });

  it("reports invalid match metadata", () => {
    const state = initialPositionBuilderState();
    state.matchLength = 7;
    state.score = [7, 0];
    state.cubeValue = 4;
    state.cubeOwner = "center";
    expect(validateBuilderState(state)).toEqual([
      "A match score must be below the match length.",
      "A cube above 1 must have an owner.",
    ]);
  });
});

// Which side canonicalPositionForForum puts on roll. A GNU Position ID is
// written from the on-roll player's point of view (decodeGnuPositionId's
// "mine" = the player on roll), and the Match ID's diceOwner/turn names that
// player. The builder's position is always bottom = `mine`, top = `opponent`,
// with playerToMove saying who is on roll.
describe("canonicalPositionForForum side to move", () => {
  // Bottom: 24:1 13:4 8:3 6:4 4:2, 1 on the bar -> 157 pips.
  // Top (in bottom's frame): 1:2 12:3 17:2 19:5 20:2, 1 off -> 143 pips.
  function state(playerToMove: PositionBuilderState["playerToMove"]): PositionBuilderState {
    const s = initialPositionBuilderState();
    const position = emptyPosition();
    for (const [point, count] of [[24, 1], [13, 4], [8, 3], [6, 4], [4, 2]]) position.mine[point - 1] = count;
    for (const [point, count] of [[1, 2], [12, 3], [17, 2], [19, 5], [20, 2]]) position.opponent[point - 1] = count;
    position.mineBar = 1;
    position.mineOff = 0;
    position.opponentOff = 1;
    s.position = position;
    s.roll = [3, 1];
    s.playerToMove = playerToMove;
    s.score = [2, 4]; // bottom 2, top 4
    s.matchLength = 7;
    return s;
  }

  function decode(s: PositionBuilderState) {
    const ids = canonicalPositionForForum(s);
    const match = decodeGnuMatchId(ids.gnuMatchId);
    if (!match) throw new Error("Match ID did not decode");
    return { position: decodeGnuPositionId(ids.positionId), match };
  }

  it("bottom to move: bottom's checkers are on roll, on roll 157 / other 143", () => {
    const s = state("mine");
    const { position, match } = decode(s);
    expect(match.diceOwner).toBe(match.turn);
    expect(position).toEqual(s.position);
    expect(pipCounts(position)).toEqual({ mine: 157, opponent: 143 });
    expect(match.score[match.diceOwner]).toBe(2); // bottom's score
    expect(match.dice).toEqual([3, 1]);
  });

  // KNOWN BUG (left failing on purpose; the fix needs the user's approval):
  // canonicalPositionForForum encodes state.position as is, so the bottom
  // side always lands in the on-roll slot, and with playerToMove "opponent"
  // the Match ID's player numbering follows it (score and cube owner make
  // the on-roll player 0 = bottom). The top side is never the one on roll:
  // GNU reads this as bottom to play 3-1 with 157 pips. Expected: the
  // position flipped (flipPerspective) so top's checkers are in the on-roll
  // slot, on roll 143 / other 157.
  it.fails("top to move: top's checkers are on roll, on roll 143 / other 157", () => {
    const s = state("opponent");
    const { position, match } = decode(s);
    expect(match.diceOwner).toBe(match.turn);
    expect(position).toEqual(flipPerspective(s.position));
    expect(pipCounts(position)).toEqual({ mine: 143, opponent: 157 });
  });

  // Same bug, seen through the score: the on-roll player's score in the
  // Match ID should be top's (4), but is bottom's (2).
  it.fails("top to move: the on-roll player's Match ID score is top's (4)", () => {
    const { match } = decode(state("opponent"));
    expect(match.score[match.diceOwner]).toBe(4);
  });
});
