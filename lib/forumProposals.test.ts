import { describe, expect, it } from "vitest";
import { cubeActionsFor, tallyProposals, validateCheckerProposal } from "@/lib/forumProposals";
import { legalSequences } from "@/lib/checkerMoves";
import { encodeGnuPositionId, type DecodedPosition } from "@/lib/gnuPositionId";
import type { DecodedMatchId } from "@/lib/gnuMatchId";

const position: DecodedPosition = {
  mine: [0, 0, 0, 0, 0, 5, 0, 3, 0, 0, 0, 0, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2],
  opponent: [2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 0, 1, 0, 2, 2, 2, 3, 0, 0, 0, 0, 0],
  mineBar: 0,
  opponentBar: 0,
  mineOff: 0,
  opponentOff: 0,
};

const match = (doubleOffered: boolean): DecodedMatchId => ({
  cubeValue: 1, cubeOwner: null, diceOwner: 0, crawford: false, gameState: 0, turn: 0,
  doubleOffered, resignationOffered: 0, dice: [6, 4], matchLength: 0,
  score: [0, 0],
});

describe("validateCheckerProposal", () => {
  it("returns legal sequence notation and the resulting ID, not client notation", () => {
    const sequence = legalSequences(position, [6, 4])[0];
    const id = encodeGnuPositionId(sequence.position);
    expect(validateCheckerProposal(position, [6, 4], id)).toEqual({ notation: sequence.notation, resultPositionId: id });
  });

  it("normalizes doubles into four dice", () => {
    const doublesPosition = { ...position, mine: [...position.mine], opponent: [...position.opponent] };
    const sequence = legalSequences(doublesPosition, [2, 2, 2, 2]).find((candidate) => candidate.hops.length === 4);
    expect(sequence).toBeDefined();
    const id = encodeGnuPositionId(sequence!.position);
    expect(validateCheckerProposal(doublesPosition, [2, 2], id)).toEqual({ notation: sequence!.notation, resultPositionId: id });
  });

  it("returns null for malformed IDs, valid but nonmatching IDs, and invalid positions", () => {
    expect(validateCheckerProposal(position, [6, 4], "not-a-position")).toBeNull();
    expect(validateCheckerProposal(position, [6, 4], "4HPwATDgc/ABMA")).toBeNull();
    expect(validateCheckerProposal({ ...position, mineOff: -1 }, [6, 4], "4HPwATDgc/ABMA")).toBeNull();
  });
});

describe("cubeActionsFor", () => {
  it("offers take and pass only when a double is pending", () => {
    expect(cubeActionsFor(match(true))).toEqual(["TAKE", "PASS"]);
  });

  it("offers pre-double actions when no double is pending", () => {
    expect(cubeActionsFor(match(false))).toEqual(["NO_DOUBLE", "DOUBLE_TAKE", "DOUBLE_PASS", "TOO_GOOD"]);
  });
});

describe("tallyProposals", () => {
  it("groups proposals and sorts by count descending with ties in first-seen order", () => {
    expect(tallyProposals([
      { key: "a", proposalId: 1, notation: "6/5", kind: "CHECKER", resultPositionId: "result-1" },
      { key: "b", proposalId: 2, kind: "CUBE", cubeAction: "TAKE" },
      { key: "a2", proposalId: 3, notation: "6/5", kind: "CHECKER", resultPositionId: "result-1" },
      { key: "b2", proposalId: 4, kind: "CUBE", cubeAction: "TAKE" },
      { key: "c", proposalId: 5, notation: "6/4", kind: "CHECKER", resultPositionId: "result-2" },
    ])).toEqual([
      { kind: "CHECKER", resultPositionId: "result-1", count: 2 },
      { kind: "CUBE", cubeAction: "TAKE", count: 2 },
      { kind: "CHECKER", resultPositionId: "result-2", count: 1 },
    ]);
  });

  it("returns an empty serializable list for no proposals", () => {
    expect(tallyProposals([])).toEqual([]);
  });
});
