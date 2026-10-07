import { describe, expect, it } from "vitest";
import {
  decisionFromRow,
  decisionFromRowForReplay,
  rollForRow,
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
    note: null,
    game: { gameIndex: 3, match: { source: "galaxy", sourceMatchId: "46576635" } },
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
    note: null,
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

describe("decisionFromRow / decisionFromRowForReplay — myLabel/bestLabel: column for CHECKER/CUBE (CUBE best derived from equities, Galaxy's wording), actionLabels() for RESIGNATION", () => {
  it("CHECKER kind: myLabel/bestLabel come from movePlayed/moveBest (same column as myMoveNotation/bestMoveNotation)", () => {
    const decision = decisionFromRow(baseRow({ movePlayed: "13/7", moveBest: "13/9" }));
    expect(decision?.myLabel).toBe("13/7");
    expect(decision?.bestLabel).toBe("13/9");
  });

  it("CUBE kind: myLabel comes from cubeActionPlayed (in Galaxy's wording), not re-parsed raw", () => {
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
    // "doubled" -> Galaxy's "Double".
    expect(decision?.myLabel).toBe("Double");
    // bestLabel is derived from the row's own cube equities (ND −0.02,
    // DT −0.12, DP 1 -> No double/take -> "No Double"), not cubeActionBest.
    expect(decision?.bestLabel).toBe("No Double");
    expect(decision?.bestDetail).toBeNull();
  });

  it("CUBE kind: the derived action wins over Galaxy's stuck 'roll' label (C2, decision 629849, 29939852 g1 Move 14)", () => {
    const cubeEvent = lowConfidenceDoubtful.data.events.find(
      (e: { reviews?: { result: { analysed_event: string } }[] }) =>
        e.reviews?.[0]?.result.analysed_event === "cube_double"
    )!;
    const raw = structuredClone(cubeEvent) as typeof cubeEvent;
    Object.assign(raw.reviews[0].result.result.cube_analysis, {
      no_double: 0.7922,
      double_take: 0.9751,
      double_pass: 1,
      doublers_best_action: "roll",
      receivers_best_action: null,
    });
    const decision = decisionFromRow(
      baseRow({
        kind: "CUBE",
        eventId: BigInt(cubeEvent.id),
        rawError: -0.1829,
        errorSeverity: "BLUNDER",
        movePlayed: null,
        moveBest: null,
        cubeActionPlayed: "did not double",
        cubeActionBest: "roll",
        raw,
      })
    );
    expect(decision?.myLabel).toBe("No Double");
    expect(decision?.bestLabel).toBe("Double");
    expect(decision?.bestDetail).toBe("opponent should take");
    expect(decision?.severity).toBe("blunder");
  });

  it("CUBE kind: a no-double check too good to double, graded none, reads Too good", () => {
    const cubeEvent = lowConfidenceDoubtful.data.events.find(
      (e: { reviews?: { result: { analysed_event: string } }[] }) =>
        e.reviews?.[0]?.result.analysed_event === "cube_double"
    )!;
    const raw = structuredClone(cubeEvent) as typeof cubeEvent;
    Object.assign(raw.reviews[0].result.result.cube_analysis, { no_double: 1.2, double_take: 1.5, double_pass: 1 });
    Object.assign(raw.reviews[0].result.result.error_analysis, { error_severity: "none" });
    const decision = decisionFromRow(
      baseRow({
        kind: "CUBE",
        eventId: BigInt(cubeEvent.id),
        rawError: 0,
        errorSeverity: "NONE",
        movePlayed: null,
        moveBest: null,
        cubeActionPlayed: "did not double",
        cubeActionBest: "roll",
        raw,
      })
    );
    expect(decision?.myLabel).toBe("Too good");
    expect(decision?.bestLabel).toBe("Too good");
    expect(decision?.bestDetail).toBe("opponent should pass");
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
    expect(decision?.myLabel).toBe("Resign");
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

// A copy of the fixture's raw event with a real GNU Match ID attached
// (the hand-built fixture's own source_match is null).
function rawWithMatchId(matchId: string) {
  const raw = structuredClone(event) as unknown as { reviews: { source_match: unknown }[] };
  raw.reviews[0].source_match = { id: 1, formatted_value: matchId };
  return raw;
}

describe("decisionFromRow / decisionFromRowForReplay — cube state: value from the column, side relative to the board's bottom player", () => {
  it("center when the Match ID's cube is centred", () => {
    const decision = decisionFromRow(
      baseRow({ cubeOwnerUserId: null, cubeValue: 1, cubeConfident: true, raw: rawWithMatchId("MAGzAAAACAAE") })
    );
    expect(decision?.cubeState).toEqual({ value: 1, owner: "center", confident: true });
  });

  it("'mine' when the owner is the player on roll (drawn at the bottom)", () => {
    // EQGvABAAAAAE (A4): owner black, dice owner white -> opponent; use a
    // state where they match: UQmgADAAEAAE (A5) owner black, dice owner black.
    const decision = decisionFromRow(
      baseRow({ cubeOwnerUserId: "user_me", cubeValue: 2, cubeConfident: true, raw: rawWithMatchId("UQmgADAAEAAE") })
    );
    expect(decision?.cubeState).toEqual({ value: 2, owner: "mine", confident: true });
  });

  it("'opponent' when the owner isn't the player on roll", () => {
    const decision = decisionFromRow(
      baseRow({ cubeOwnerUserId: "user_me", cubeValue: 2, cubeConfident: true, raw: rawWithMatchId("EQGvABAAAAAE") })
    );
    expect(decision?.cubeState).toEqual({ value: 2, owner: "opponent", confident: true });
  });

  it("a take row (A2): the doubler's cube is beside the doubler at the bottom, not relative to the receiving actor", () => {
    // ARmgAAAACAAE: the opponent (white) owns a 2-cube, redoubles; the user
    // (black) is the row's actor. Before 2026-10-06 the cube was
    // relativized to row.userId and drawn on the wrong side.
    const decision = decisionFromRowForReplay(
      baseRow({
        kind: "CUBE",
        userId: "user_me",
        cubeOwnerUserId: "user_opponent",
        cubeValue: 2,
        cubeConfident: true,
        raw: rawWithMatchId("ARmgAAAACAAE"),
      })
    );
    expect(decision?.cubeState).toEqual({ value: 2, owner: "mine", confident: true });
  });

  it("no cube when cubeConfident is false/null, cubeValue is null, or the Match ID doesn't decode", () => {
    const raw = rawWithMatchId("EQGvABAAAAAE");
    expect(decisionFromRow(baseRow({ cubeConfident: false, raw }))?.cubeState).toBeNull();
    expect(decisionFromRow(baseRow({ cubeConfident: null, raw }))?.cubeState).toBeNull();
    expect(decisionFromRow(baseRow({ cubeValue: null, raw }))?.cubeState).toBeNull();
    expect(decisionFromRowForReplay(baseRow({ cubeValue: null, raw }))?.cubeState).toBeNull();
    expect(decisionFromRow(baseRow({ raw: event }))?.cubeState).toBeNull();
  });
});

// A take/pass (cube_pass) raw payload with the given Match ID and take flag.
function rawCubePass(matchId: string, take: boolean | null) {
  const raw = rawWithMatchId(matchId) as unknown as {
    reviews: { take: boolean | null; result: { analysed_event: string } }[];
  };
  raw.reviews[0].result.analysed_event = "cube_pass";
  raw.reviews[0].take = take;
  return raw;
}

describe("decisionFromRow / decisionFromRowForReplay — take/pass board frame and double offer", () => {
  it("a take row (A2, 45282503 g2 Move 16): position from the doubler's side, a redouble to 4, took", () => {
    // ARmgAAAACAAE: dice owner white (the redoubler), turn black (the
    // user, taking), cube 2 owned by white.
    for (const build of [decisionFromRow, decisionFromRowForReplay]) {
      const decision = build(
        baseRow({ kind: "CUBE", cubeValue: 2, cubeConfident: true, raw: rawCubePass("ARmgAAAACAAE", true) })
      );
      expect(decision?.positionFromOpponent).toBe(true);
      expect(decision?.doubleOffer).toEqual({ value: 4, redouble: true, took: true });
      // The list's cube square shows the offered value.
      expect(decision?.cubeSquareValue).toBe(4);
    }
  });

  it("a checker row: actor's own position, no double offer", () => {
    const decision = decisionFromRow(baseRow({ raw: rawWithMatchId("QQmxAAAACAAE") }));
    expect(decision?.positionFromOpponent).toBe(false);
    expect(decision?.doubleOffer).toBeNull();
    expect(decision?.cubeSquareValue).toBeNull();
  });
});

describe("rollForRow — no dice on cube decisions", () => {
  it("CUBE rows get no dice even when the roll column holds a neighbouring roll", () => {
    expect(rollForRow({ kind: "CUBE", roll: [6, 2] })).toEqual([]);
    expect(decisionFromRow(baseRow({ kind: "CUBE", roll: [6, 2] }))?.roll).toEqual([]);
    expect(decisionFromRowForReplay(baseRow({ kind: "CUBE", roll: [6, 2] }))?.roll).toEqual([]);
  });

  it("CHECKER rows keep their roll; null becomes []", () => {
    expect(rollForRow({ kind: "CHECKER", roll: [6, 2] })).toEqual([6, 2]);
    expect(rollForRow({ kind: "CHECKER", roll: null })).toEqual([]);
    expect(rollForRow({ kind: "RESIGNATION", roll: [3, 1] })).toEqual([3, 1]);
  });
});

describe("toDecisionListItems", () => {
  it("builds an item per row with its classification and match link", () => {
    const [item] = toDecisionListItems([row()]);
    expect(item.classification).toBe("opening_game");
    expect(item.matchHref).toBe("/matches/46576635");
    expect(item.externalMatchHref).toBe(
      "https://www.backgammongalaxy.com/play/page_analysis_match_details?match_id=46576635"
    );
    expect(item.decision.id).toBe("1");
    expect(item.decision.gameIndex).toBe(3);
    expect(item.decision.severity).toBe("blunder");
    expect(item.decision.absError).toBeCloseTo(0.12);
    expect(item.decision.sourcePositionId).toBe("4HPwATDgc/ABMA");
  });

  it("no external link for a match from a non-Galaxy source", () => {
    const [item] = toDecisionListItems([row({ game: { gameIndex: 3, match: { source: "xg", sourceMatchId: "1" } } })]);
    expect(item.externalMatchHref).toBeNull();
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

describe("note and dbDecisionId", () => {
  it("carries the joined note text and the real DB id, on both mappers", () => {
    const withNote = baseRow({ id: 42, note: { note: "should have slotted", updatedAt: new Date(0) } });
    for (const decision of [decisionFromRow(withNote), decisionFromRowForReplay(withNote)]) {
      expect(decision?.note).toBe("should have slotted");
      expect(decision?.dbDecisionId).toBe(42);
      expect(decision?.id).toBe("42");
    }
  });

  it("a decision without a note gets note null but still its DB id (so a note can be added)", () => {
    const decision = decisionFromRow(baseRow({ id: 7, note: null }));
    expect(decision?.note).toBeNull();
    expect(decision?.dbDecisionId).toBe(7);
  });
});
