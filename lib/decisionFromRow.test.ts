import { describe, expect, it } from "vitest";
import {
  decisionFromRow,
  decisionFromRowForReplay,
  toDecisionListItems,
  type DecisionListRow,
  type DecisionRow,
} from "@/lib/decisionFromRow";
import moneyGameMove from "./__fixtures__/galaxy-payloads/money-game-move.json";
import resignation from "./__fixtures__/galaxy-payloads/resignation.json";
import lowConfidenceDoubtful from "./__fixtures__/galaxy-payloads/low-confidence-doubtful.json";

// A real-shaped move_commited event (with reviews[0]) as the raw column.
const event = moneyGameMove.data.events[0];

function row(overrides: Partial<DecisionListRow> = {}): DecisionListRow {
  return {
    id: 1,
    gameId: 10,
    eventId: BigInt(event.id),
    userId: "user_me",
    color: "white",
    kind: "CHECKER",
    rawError: -0.12,
    errorSeverity: "BLUNDER",
    // Real values for this fixture's own event — confirmed matching what
    // moveNotations(review) would derive from it (the column/raw-parse
    // equivalence this project verified directly before switching, 2026-10-01).
    movePlayed: "24/18",
    moveBest: "24/18",
    // CUBE-kind-only columns — irrelevant for this CHECKER-kind default row,
    // but present since every DecisionRow has them (null outside CUBE kind,
    // same convention movePlayed/moveBest use outside CHECKER kind).
    cubeActionPlayed: null,
    cubeActionBest: null,
    // Real value for this fixture's own event (reviews[0].source_position.
    // formatted_value) — same "column, not re-parsed raw" equivalence
    // confirmed for movePlayed/moveBest above.
    sourcePositionId: "4HPwATDgc/ABMA",
    roll: [6, 2],
    cubeOwnerUserId: null,
    cubeValue: 1,
    cubeConfident: true,
    raw: event,
    classification: "opening_game",
    game: { gameIndex: 3, match: { sourceMatchId: "46576635" } },
    ...overrides,
  };
}

// Minimal DecisionRow builder for decisionFromRow/decisionFromRowForReplay
// tests directly (no classification/match needed, unlike the list-item row
// helper above).
function baseRow(overrides: Partial<DecisionRow> = {}): DecisionRow {
  return {
    id: 1,
    gameId: 10,
    eventId: BigInt(event.id),
    userId: "user_me",
    color: "white",
    kind: "CHECKER",
    rawError: -0.12,
    errorSeverity: "BLUNDER",
    movePlayed: "24/18",
    moveBest: "24/18",
    cubeActionPlayed: null,
    cubeActionBest: null,
    sourcePositionId: "4HPwATDgc/ABMA",
    roll: [6, 2],
    cubeOwnerUserId: null,
    cubeValue: 1,
    cubeConfident: true,
    raw: event,
    game: { gameIndex: 3 },
    ...overrides,
  };
}

describe("decisionFromRow / decisionFromRowForReplay — notation from the column, not re-parsed raw", () => {
  it("decisionFromRow returns the row's own movePlayed/moveBest columns verbatim", () => {
    // Deliberately different from what moveNotations(review) would derive
    // from this fixture's raw ("24/18" for both, confirmed earlier) — if
    // this still silently re-parsed raw instead of reading the column, the
    // assertions below would see "24/18", not these values, and fail.
    const decision = decisionFromRow(baseRow({ movePlayed: "99/1", moveBest: "88/2" }));
    expect(decision?.myMoveNotation).toBe("99/1");
    expect(decision?.bestMoveNotation).toBe("88/2");
  });

  it("decisionFromRowForReplay returns the row's own movePlayed/moveBest columns verbatim", () => {
    const decision = decisionFromRowForReplay(baseRow({ movePlayed: "99/1", moveBest: "88/2" }));
    expect(decision?.myMoveNotation).toBe("99/1");
    expect(decision?.bestMoveNotation).toBe("88/2");
  });

  it("real CHECKER row: column value matches what the raw payload actually contains", () => {
    // moneyGameMove's own event — confirmed "24/18"/"24/18" via direct
    // inspection of its raw moves[] array (rank 1 === move_played here).
    const decision = decisionFromRow(baseRow());
    expect(decision?.myMoveNotation).toBe("24/18");
    expect(decision?.bestMoveNotation).toBe("24/18");
  });

  it("real RESIGNATION row: notation columns are null (ingest never populates them for this kind)", () => {
    const resignEvent = resignation.data.events[0];
    const decision = decisionFromRow(
      baseRow({
        kind: "RESIGNATION",
        eventId: BigInt(resignEvent.id),
        rawError: 0.15,
        errorSeverity: "NONE",
        movePlayed: null,
        moveBest: null,
        raw: resignEvent,
      })
    );
    expect(decision?.myMoveNotation).toBeNull();
    expect(decision?.bestMoveNotation).toBeNull();
  });

  it("real CUBE row (null rawError, via decisionFromRowForReplay): notation columns are null", () => {
    const cubeEvent = lowConfidenceDoubtful.data.events.find(
      (e: { reviews?: { result: { analysed_event: string } }[] }) =>
        e.reviews?.[0]?.result.analysed_event === "cube_double"
    )!;
    const decision = decisionFromRowForReplay(
      baseRow({
        kind: "CUBE",
        eventId: BigInt(cubeEvent.id),
        rawError: null,
        errorSeverity: "NONE",
        movePlayed: null,
        moveBest: null,
        raw: cubeEvent,
      })
    );
    expect(decision?.myMoveNotation).toBeNull();
    expect(decision?.bestMoveNotation).toBeNull();
  });
});

describe("decisionFromRow / decisionFromRowForReplay — myLabel/bestLabel: column for CHECKER/CUBE, actionLabels() for RESIGNATION", () => {
  it("CHECKER kind: myLabel/bestLabel come from movePlayed/moveBest (same column as myMoveNotation/bestMoveNotation)", () => {
    const decision = decisionFromRow(baseRow({ movePlayed: "13/7", moveBest: "13/9" }));
    expect(decision?.myLabel).toBe("13/7");
    expect(decision?.bestLabel).toBe("13/9");
  });

  it("CUBE kind: myLabel/bestLabel come from cubeActionPlayed/cubeActionBest, not re-parsed raw", () => {
    // Real cube_double event from the fixture (low-confidence-doubtful.json)
    // — deliberately different literal values than actionLabels(review)
    // would derive from it, so a silent raw-reparse would be caught.
    const cubeEvent = lowConfidenceDoubtful.data.events.find(
      (e: { reviews?: { result: { analysed_event: string } }[] }) =>
        e.reviews?.[0]?.result.analysed_event === "cube_double"
    )!;
    const decision = decisionFromRowForReplay(
      baseRow({
        kind: "CUBE",
        eventId: BigInt(cubeEvent.id),
        rawError: null,
        errorSeverity: "NONE",
        movePlayed: null,
        moveBest: null,
        cubeActionPlayed: "doubled",
        cubeActionBest: "double",
        raw: cubeEvent,
      })
    );
    expect(decision?.myLabel).toBe("doubled");
    expect(decision?.bestLabel).toBe("double");
  });

  it("RESIGNATION kind: myLabel/bestLabel still call actionLabels() against raw — no column for this kind, deliberately", () => {
    const resignEvent = resignation.data.events[0];
    const decision = decisionFromRow(
      baseRow({
        kind: "RESIGNATION",
        eventId: BigInt(resignEvent.id),
        rawError: 0.15,
        errorSeverity: "NONE",
        movePlayed: null,
        moveBest: null,
        raw: resignEvent,
      })
    );
    expect(decision?.myLabel).toBe("resigned");
    expect(decision?.bestLabel).toBe("should resign"); // this fixture's should_resign: true
  });
});

describe("decisionFromRow / decisionFromRowForReplay — roll from the column, not re-scanned", () => {
  it("decisionFromRow returns the row's own roll column verbatim", () => {
    const decision = decisionFromRow(baseRow({ roll: [3, 1] }));
    expect(decision?.roll).toEqual([3, 1]);
  });

  it("decisionFromRowForReplay returns the row's own roll column verbatim", () => {
    const decision = decisionFromRowForReplay(baseRow({ roll: [3, 1] }));
    expect(decision?.roll).toEqual([3, 1]);
  });

  it("null roll (the genuine first-move/no-roll-applies case) becomes an empty array, not null", () => {
    expect(decisionFromRow(baseRow({ roll: null }))?.roll).toEqual([]);
    expect(decisionFromRowForReplay(baseRow({ roll: null }))?.roll).toEqual([]);
  });
});

describe("decisionFromRow / decisionFromRowForReplay — cube state from the column, not re-walked", () => {
  it("converts absolute cubeOwnerUserId to relative owner: center when null", () => {
    const decision = decisionFromRow(
      baseRow({ cubeOwnerUserId: null, cubeValue: 1, cubeConfident: true })
    );
    expect(decision?.cubeState).toEqual({ value: 1, owner: "center", confident: true });
  });

  it("'mine' when cubeOwnerUserId matches the row's own userId", () => {
    const decision = decisionFromRow(
      baseRow({ userId: "user_me", cubeOwnerUserId: "user_me", cubeValue: 2, cubeConfident: true })
    );
    expect(decision?.cubeState).toEqual({ value: 2, owner: "mine", confident: true });
  });

  it("'opponent' when cubeOwnerUserId differs from the row's own userId", () => {
    const decision = decisionFromRow(
      baseRow({ userId: "user_me", cubeOwnerUserId: "user_opponent", cubeValue: 4, cubeConfident: false })
    );
    expect(decision?.cubeState).toEqual({ value: 4, owner: "opponent", confident: false });
  });

  it("null cubeValue or cubeConfident (migration-sequencing gap, not yet backfilled) means null cubeState, not a crash", () => {
    expect(decisionFromRow(baseRow({ cubeValue: null }))?.cubeState).toBeNull();
    expect(decisionFromRow(baseRow({ cubeConfident: null }))?.cubeState).toBeNull();
    expect(decisionFromRowForReplay(baseRow({ cubeValue: null }))?.cubeState).toBeNull();
  });
});

describe("toDecisionListItems", () => {
  it("builds an item per row with its classification and match link", () => {
    const [item] = toDecisionListItems([row()]);
    expect(item.classification).toBe("opening_game");
    expect(item.matchHref).toBe("/matches/46576635");
    expect(item.decision.id).toBe("1");
    expect(item.decision.gameIndex).toBe(3);
    expect(item.decision.severity).toBe("blunder");
    expect(item.decision.absError).toBeCloseTo(0.12);
    expect(item.decision.sourcePositionId).toBe("4HPwATDgc/ABMA");
  });

  it("reads roll from the row's own column, not a lookup — null becomes []", () => {
    expect(toDecisionListItems([row({ roll: [5, 4] })])[0].decision.roll).toEqual([5, 4]);
    expect(toDecisionListItems([row({ roll: null })])[0].decision.roll).toEqual([]);
  });

  it("drops rows decisionFromRow can't build, keeping the rest in order", () => {
    const items = toDecisionListItems([
      row({ id: 1 }),
      row({ id: 2, rawError: null }),
      row({ id: 3, raw: { reviews: [] } }),
      row({ id: 4 }),
    ]);
    expect(items.map((i) => i.decision.id)).toEqual(["1", "4"]);
  });

  it("returns an empty list for no rows", () => {
    expect(toDecisionListItems([])).toEqual([]);
  });
});
