import { describe, expect, it } from "vitest";
import {
  decisionFromRow,
  decisionFromRowForReplay,
  toDecisionListItems,
  type DecisionListRow,
  type DecisionRow,
} from "@/lib/decisionFromRow";
import { decodeGnuMatchId, encodeGnuMatchId } from "@/lib/gnuMatchId";
import moneyGameMove from "./__fixtures__/galaxy-payloads/money-game-move.json";
import resignation from "./__fixtures__/galaxy-payloads/resignation.json";
import lowConfidenceDoubtful from "./__fixtures__/galaxy-payloads/low-confidence-doubtful.json";

// A real-shaped move_commited event (with reviews[0]) as the raw column.
// Its played and best move are both "24/18", its colour "white", and its
// own source_match is null (no Match ID: no dice, no cube).
const event = moneyGameMove.data.events[0];

// The fixture's real cube_double event (low-confidence-doubtful.json).
const cubeEvent = lowConfidenceDoubtful.data.events.find(
  (e: { reviews?: { result: { analysed_event: string } }[] }) => e.reviews?.[0]?.result.analysed_event === "cube_double"
)!;

function row(overrides: Partial<DecisionListRow> = {}): DecisionListRow {
  return {
    id: 1,
    gameId: 10,
    eventId: BigInt(event.id),
    userId: "user_me",
    kind: "CHECKER",
    rawError: -0.12,
    errorSeverity: "BLUNDER",
    // Real value for this fixture's own event (reviews[0].source_position.
    // formatted_value).
    sourcePositionId: "4HPwATDgc/ABMA",
    raw: event,
    classification: "opening_game",
    note: null,
    game: { gameIndex: 3, match: { source: "galaxy", sourceMatchId: "46576635" } },
    ...overrides,
  };
}

// Minimal DecisionRow builder for decisionFromRow/decisionFromRowForReplay
// tests directly (no classification/sourceMatchId needed, unlike the
// list-item row helper above).
function baseRow(overrides: Partial<DecisionRow> = {}): DecisionRow {
  return {
    id: 1,
    gameId: 10,
    eventId: BigInt(event.id),
    userId: "user_me",
    kind: "CHECKER",
    rawError: -0.12,
    errorSeverity: "BLUNDER",
    sourcePositionId: "4HPwATDgc/ABMA",
    raw: event,
    note: null,
    game: { gameIndex: 3, match: { source: "galaxy" } },
    ...overrides,
  };
}

// A copy of `base` (default: the checker fixture's event) with a real GNU
// Match ID attached (the hand-built fixture's own source_match is null).
function rawWithMatchId(matchId: string, base: unknown = event) {
  const raw = structuredClone(base) as unknown as { reviews: { source_match: unknown }[] };
  raw.reviews[0].source_match = { id: 1, formatted_value: matchId };
  return raw;
}

// A Match ID whose dice are `dice` (everything else from a real ID).
function matchIdWithDice(dice: [number, number]): string {
  return encodeGnuMatchId({ ...decodeGnuMatchId("QQmxAAAACAAE")!, dice });
}

// A copy of `base` with one candidate's notation / the move_played flag
// changed, so a label read from somewhere other than raw would be caught.
function rawWithMoves(moves: { notation: string; rank: number; move_played: boolean }[]) {
  const raw = structuredClone(event) as unknown as {
    reviews: { result: { result: { moves: Record<string, unknown>[] } } }[];
  };
  const template = raw.reviews[0].result.result.moves[0];
  raw.reviews[0].result.result.moves = moves.map((m) => ({ ...template, ...m }));
  return raw;
}

describe("decisionFromRow / decisionFromRowForReplay — notation and labels from raw", () => {
  it("both builders read the played/best notation from raw's candidates", () => {
    const raw = rawWithMoves([
      { notation: "13/9 6/5", rank: 1, move_played: false },
      { notation: "24/20 13/12", rank: 2, move_played: true },
    ]);
    for (const build of [decisionFromRow, decisionFromRowForReplay]) {
      const decision = build(baseRow({ raw }));
      expect(decision?.myMoveNotation).toBe("24/20 13/12");
      expect(decision?.bestMoveNotation).toBe("13/9 6/5");
      // CHECKER labels are the same notations.
      expect(decision?.myLabel).toBe("24/20 13/12");
      expect(decision?.bestLabel).toBe("13/9 6/5");
      expect(decision?.bestDetail).toBeNull();
    }
  });

  it("real CHECKER row: the fixture's own 24/18 for both", () => {
    const decision = decisionFromRow(baseRow());
    expect(decision?.myMoveNotation).toBe("24/18");
    expect(decision?.bestMoveNotation).toBe("24/18");
  });

  it("real RESIGNATION row: no notations, labels from actionLabels() in Galaxy's wording", () => {
    const resignEvent = resignation.data.events[0];
    const decision = decisionFromRow(
      baseRow({ kind: "RESIGNATION", eventId: BigInt(resignEvent.id), rawError: 0.15, errorSeverity: "NONE", raw: resignEvent })
    );
    expect(decision?.myMoveNotation).toBeNull();
    expect(decision?.bestMoveNotation).toBeNull();
    expect(decision?.myLabel).toBe("Resign");
    expect(decision?.bestLabel).toBe("should resign"); // this fixture's should_resign: true
  });

  it("real CUBE row (null rawError, via decisionFromRowForReplay): no notations; Galaxy's wording, best derived from the equities", () => {
    const decision = decisionFromRowForReplay(
      baseRow({ kind: "CUBE", eventId: BigInt(cubeEvent.id), rawError: null, errorSeverity: "NONE", raw: cubeEvent })
    );
    expect(decision?.myMoveNotation).toBeNull();
    expect(decision?.bestMoveNotation).toBeNull();
    // review.double false -> "did not double" -> "No Double"; ND −0.02,
    // DT −0.12, DP 1 -> No double/take -> "No Double".
    expect(decision?.myLabel).toBe("No Double");
    expect(decision?.bestLabel).toBe("No Double");
    expect(decision?.bestDetail).toBeNull();
  });

  it("CUBE kind: the derived action wins over Galaxy's stuck 'roll' label (C2, decision 629849, 29939852 g1 Move 14)", () => {
    const raw = structuredClone(cubeEvent) as typeof cubeEvent;
    Object.assign(raw.reviews[0].result.result.cube_analysis, {
      no_double: 0.7922,
      double_take: 0.9751,
      double_pass: 1,
      doublers_best_action: "roll",
      receivers_best_action: null,
    });
    Object.assign(raw.reviews[0].result.result.error_analysis, { error_severity: "blunder" });
    const decision = decisionFromRow(
      baseRow({ kind: "CUBE", eventId: BigInt(cubeEvent.id), rawError: -0.1829, errorSeverity: "BLUNDER", raw })
    );
    expect(decision?.myLabel).toBe("No Double");
    expect(decision?.bestLabel).toBe("Double");
    expect(decision?.bestDetail).toBe("opponent should take");
    expect(decision?.severity).toBe("blunder");
  });

  it("CUBE kind: a no-double check too good to double, graded none, reads Too good", () => {
    const raw = structuredClone(cubeEvent) as typeof cubeEvent;
    Object.assign(raw.reviews[0].result.result.cube_analysis, { no_double: 1.2, double_take: 1.5, double_pass: 1 });
    Object.assign(raw.reviews[0].result.result.error_analysis, { error_severity: "none" });
    const decision = decisionFromRow(
      baseRow({ kind: "CUBE", eventId: BigInt(cubeEvent.id), rawError: 0, errorSeverity: "NONE", raw })
    );
    expect(decision?.myLabel).toBe("Too good");
    expect(decision?.bestLabel).toBe("Too good");
    expect(decision?.bestDetail).toBe("opponent should pass");
  });

  it("CUBE kind: a double reads Double (review.double true)", () => {
    const raw = structuredClone(cubeEvent) as typeof cubeEvent;
    (raw.reviews[0] as { double: boolean | null }).double = true;
    const decision = decisionFromRowForReplay(
      baseRow({ kind: "CUBE", eventId: BigInt(cubeEvent.id), rawError: null, errorSeverity: "NONE", raw })
    );
    expect(decision?.myLabel).toBe("Double");
  });
});

describe("decisionFromRow / decisionFromRowForReplay — colour from raw", () => {
  it("raw.color, for both builders", () => {
    expect(decisionFromRow(baseRow())?.color).toBe("white");
    const black = { ...structuredClone(event), color: "black" };
    expect(decisionFromRowForReplay(baseRow({ raw: black }))?.color).toBe("black");
  });

  it("blank when raw has none (Galaxy leaves it blank on most cube rows)", () => {
    const blank = { ...structuredClone(event), color: "" };
    expect(decisionFromRow(baseRow({ raw: blank }))?.color).toBe("");
  });
});

describe("decisionFromRow / decisionFromRowForReplay — roll from the Match ID's dice", () => {
  it("a checker move shows the Match ID's dice, in its order, on both builders", () => {
    const raw = rawWithMatchId(matchIdWithDice([5, 2]));
    expect(decisionFromRow(baseRow({ raw }))?.roll).toEqual([5, 2]);
    expect(decisionFromRowForReplay(baseRow({ raw }))?.roll).toEqual([5, 2]);
    expect(decisionFromRow(baseRow({ raw: rawWithMatchId(matchIdWithDice([3, 3])) }))?.roll).toEqual([3, 3]);
  });

  it("decision 749213 (match 35478993 g6, 23/21 15/10): EYHqAEAAIAAE gives 5-2 (the old column said 3-3)", () => {
    expect(decisionFromRow(baseRow({ raw: rawWithMatchId("EYHqAEAAIAAE") }))?.roll).toEqual([5, 2]);
  });

  it("no Match ID -> no dice", () => {
    expect(decisionFromRow(baseRow())?.roll).toEqual([]);
  });

  it("cube decisions and resignations get no dice, even with dice in the Match ID", () => {
    const id = matchIdWithDice([6, 2]);
    const cube = decisionFromRowForReplay(
      baseRow({ kind: "CUBE", rawError: null, errorSeverity: "NONE", raw: rawWithMatchId(id, cubeEvent) })
    );
    expect(cube?.roll).toEqual([]);
    const resign = decisionFromRowForReplay(
      baseRow({ kind: "RESIGNATION", rawError: 0.15, errorSeverity: "NONE", raw: rawWithMatchId(id, resignation.data.events[0]) })
    );
    expect(resign?.roll).toEqual([]);
  });
});

describe("decisionFromRow / decisionFromRowForReplay — cube state from the Match ID, side relative to the board's bottom player", () => {
  it("center when the Match ID's cube is centred", () => {
    const decision = decisionFromRow(baseRow({ raw: rawWithMatchId("MAGzAAAACAAE") }));
    expect(decision?.cubeState).toEqual({ value: 1, owner: "center", confident: true });
  });

  it("'mine' when the owner is the player on roll (drawn at the bottom)", () => {
    // UQmgADAAEAAE (A5): owner black, dice owner black.
    const decision = decisionFromRow(baseRow({ raw: rawWithMatchId("UQmgADAAEAAE") }));
    expect(decision?.cubeState).toEqual({ value: 2, owner: "mine", confident: true });
  });

  it("'opponent' when the owner isn't the player on roll", () => {
    // EQGvABAAAAAE (A4): owner black, dice owner white.
    const decision = decisionFromRow(baseRow({ raw: rawWithMatchId("EQGvABAAAAAE") }));
    expect(decision?.cubeState).toEqual({ value: 2, owner: "opponent", confident: true });
  });

  it("a take row (A2): the doubler's cube is beside the doubler at the bottom, not relative to the receiving actor", () => {
    // ARmgAAAACAAE: the opponent (white) owns a 2-cube, redoubles; the user
    // (black) is the row's actor.
    const decision = decisionFromRowForReplay(
      baseRow({ kind: "CUBE", userId: "user_me", raw: rawWithMatchId("ARmgAAAACAAE") })
    );
    expect(decision?.cubeState).toEqual({ value: 2, owner: "mine", confident: true });
  });

  it("no cube when the Match ID is missing or doesn't decode", () => {
    expect(decisionFromRow(baseRow({ raw: event }))?.cubeState).toBeNull();
    expect(decisionFromRow(baseRow({ raw: rawWithMatchId("not-a-match") }))?.cubeState).toBeNull();
  });
});

// A take/pass (cube_pass) raw payload with the given Match ID and take flag,
// built from the fixture's real cube event (every stored cube row has a
// cube_analysis — ingest used to read it for the dropped label columns).
function rawCubePass(matchId: string, take: boolean | null) {
  const raw = rawWithMatchId(matchId, cubeEvent) as unknown as {
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
      const decision = build(baseRow({ kind: "CUBE", raw: rawCubePass("ARmgAAAACAAE", true) }));
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

describe("decisionFromRow / decisionFromRowForReplay — raw is never modified", () => {
  it("building a decision leaves raw byte-identical", () => {
    const raw = rawCubePass("ARmgAAAACAAE", true);
    const before = JSON.stringify(raw);
    decisionFromRow(baseRow({ kind: "CUBE", raw }));
    decisionFromRowForReplay(baseRow({ kind: "CUBE", raw }));
    expect(JSON.stringify(raw)).toBe(before);
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

  it("a row from a source with no reader is dropped (nothing to derive its labels from)", () => {
    const items = toDecisionListItems([row({ game: { gameIndex: 3, match: { source: "xg", sourceMatchId: "1" } } })]);
    expect(items).toEqual([]);
  });

  it("reads the roll from each row's own raw", () => {
    const raw = rawWithMatchId(matchIdWithDice([5, 4]));
    expect(toDecisionListItems([row({ raw })])[0].decision.roll).toEqual([5, 4]);
    expect(toDecisionListItems([row()])[0].decision.roll).toEqual([]);
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
