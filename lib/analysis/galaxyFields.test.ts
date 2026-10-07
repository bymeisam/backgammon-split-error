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
  galaxyRoll,
} from "@/lib/analysis/galaxyFields";
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
