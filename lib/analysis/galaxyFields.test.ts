// lib/analysis/galaxyFields.ts: Galaxy's readers for the display values that
// used to be Decision columns. The builders that use them are covered in
// lib/decisionFromRow.test.ts; this checks each reader on its own.
import { describe, expect, it } from "vitest";
import {
  galaxyAnalysedEvent,
  galaxyBoardFrame,
  galaxyColor,
  galaxyCubeState,
  galaxyLabels,
  galaxyMatchContext,
  galaxyRoll,
} from "@/lib/analysis/galaxyFields";
import { decodeGnuMatchId, encodeGnuMatchId, type DecodedMatchId } from "@/lib/gnuMatchId";
import examples from "@/lib/__fixtures__/analysis/galaxy-analysis-examples.json";

type Example = { decisionId: number; analysedEvent: string; roll?: number[]; raw: unknown };
const ex = examples as unknown as Record<string, Example>;

// A minimal Galaxy event: colour, event type and (optionally) a Match ID.
function raw(opts: { color?: unknown; event?: string; matchId?: string; take?: boolean; double?: boolean }): unknown {
  return {
    color: opts.color,
    reviews: [
      {
        take: opts.take ?? null,
        double: opts.double ?? null,
        source_match: opts.matchId ? { id: 1, formatted_value: opts.matchId } : null,
        result: { analysed_event: opts.event ?? "move", result: { moves: [], cube_analysis: {}, error_analysis: null } },
      },
    ],
  };
}

describe("galaxyAnalysedEvent", () => {
  it("reads reviews[0].result.analysed_event", () => {
    expect(galaxyAnalysedEvent(raw({ event: "cube_pass" }))).toBe("cube_pass");
    for (const name of ["C1", "cubeDouble", "cubePassNegated", "resignation"]) {
      expect(galaxyAnalysedEvent(ex[name].raw)).toBe(ex[name].analysedEvent);
    }
  });

  it("null without a review", () => {
    expect(galaxyAnalysedEvent(null)).toBeNull();
    expect(galaxyAnalysedEvent({ reviews: [] })).toBeNull();
    expect(galaxyAnalysedEvent({ reviews: [{}] })).toBeNull();
  });
});

describe("galaxyColor", () => {
  it("raw.color, or '' when missing or not a string", () => {
    expect(galaxyColor(raw({ color: "black" }))).toBe("black");
    expect(galaxyColor(raw({ color: "" }))).toBe("");
    expect(galaxyColor(raw({ color: 3 }))).toBe("");
    expect(galaxyColor(null)).toBe("");
  });
});

describe("galaxyRoll / galaxyCubeState / galaxyBoardFrame — from the Match ID", () => {
  it("a move's dice; no dice on cube rows", () => {
    expect(galaxyRoll(raw({ matchId: "EYHqAEAAIAAE" }))).toEqual([5, 2]);
    expect(galaxyRoll(raw({ event: "cube_double", matchId: "EYHqAEAAIAAE" }))).toEqual([]);
    expect(galaxyRoll(raw({}))).toEqual([]);
  });

  it("higher die first, whatever the Match ID's order (display only, as Galaxy shows it)", () => {
    const base = decodeGnuMatchId("EYHqAEAAIAAE")!;
    const lowFirst = encodeGnuMatchId({ ...base, dice: [3, 6] });
    expect(decodeGnuMatchId(lowFirst)!.dice).toEqual([3, 6]);
    expect(galaxyRoll(raw({ matchId: lowFirst }))).toEqual([6, 3]);
  });

  it("the cube entering the decision", () => {
    expect(galaxyCubeState(raw({ matchId: "EQGvABAAAAAE" }))).toEqual({ value: 2, owner: "opponent", confident: true });
    expect(galaxyCubeState(raw({}))).toBeNull();
  });

  it("a take (ARmgAAAACAAE): flipped, a redouble to 4, took; square 4", () => {
    expect(galaxyBoardFrame(raw({ event: "cube_pass", matchId: "ARmgAAAACAAE", take: true }))).toEqual({
      positionFromOpponent: true,
      doubleOffer: { value: 4, redouble: true, took: true },
      cubeSquareValue: 4,
    });
  });

  it("no review: unflipped, nothing offered", () => {
    expect(galaxyBoardFrame(null)).toEqual({ positionFromOpponent: false, doubleOffer: null, cubeSquareValue: null });
  });
});

describe("galaxyLabels", () => {
  it("C1 (decision 1236446): played and best notation from the candidates (Galaxy's rank 1 as best)", () => {
    const labels = galaxyLabels(ex.C1.raw);
    expect(labels).not.toBeNull();
    expect(labels!.mine).toBe(labels!.myMoveNotation);
    expect(labels!.best).toBe(labels!.bestMoveNotation);
    expect(labels!.bestDetail).toBeNull();
  });

  it("null without a review", () => {
    expect(galaxyLabels({ reviews: [] })).toBeNull();
  });
});

describe("galaxyMatchContext — length, scores and Crawford from the decision-maker's view", () => {
  const base: DecodedMatchId = decodeGnuMatchId("EYHqAEAAIAAE")!;
  const id = (over: Partial<DecodedMatchId>) => encodeGnuMatchId({ ...base, ...over });

  it("a move: the dice owner's score first", () => {
    const m = id({ matchLength: 5, score: [2, 3], diceOwner: 1, turn: 1, crawford: false });
    expect(galaxyMatchContext(raw({ matchId: m }))).toEqual({
      matchLength: 5,
      deciderScore: 3,
      opponentScore: 2,
      crawford: "none",
    });
    const w = id({ matchLength: 5, score: [2, 3], diceOwner: 0, turn: 0, crawford: false });
    expect(galaxyMatchContext(raw({ matchId: w }))?.deciderScore).toBe(2);
  });

  it("a take/pass: the turn (the receiver) is the decision-maker, not the dice owner", () => {
    const m = id({ matchLength: 7, score: [1, 4], diceOwner: 1, turn: 0, doubleOffered: true });
    expect(galaxyMatchContext(raw({ event: "cube_pass", matchId: m }))).toMatchObject({ deciderScore: 1, opponentScore: 4 });
  });

  it("Crawford and post-Crawford", () => {
    const c = id({ matchLength: 5, score: [4, 2], crawford: true });
    expect(galaxyMatchContext(raw({ matchId: c }))?.crawford).toBe("crawford");
    const p = id({ matchLength: 5, score: [4, 3], crawford: false });
    expect(galaxyMatchContext(raw({ matchId: p }))?.crawford).toBe("post_crawford");
  });

  it("money (length 0, or an even decoded length): no scores", () => {
    for (const matchLength of [0, 8]) {
      expect(galaxyMatchContext(raw({ matchId: id({ matchLength, score: [0, 0] }) }))).toEqual({
        matchLength: 0,
        deciderScore: null,
        opponentScore: null,
        crawford: "none",
      });
    }
  });

  it("null without a Match ID, and for a resignation", () => {
    expect(galaxyMatchContext(raw({}))).toBeNull();
    expect(galaxyMatchContext(raw({ event: "resignation", matchId: "EYHqAEAAIAAE" }))).toBeNull();
  });
});
