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
    notationPlayed: "24/18",
    notationBest: "24/18",
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
    notationPlayed: "24/18",
    notationBest: "24/18",
    raw: event,
    game: { gameIndex: 3 },
    ...overrides,
  };
}

describe("decisionFromRow / decisionFromRowForReplay — notation from the column, not re-parsed raw", () => {
  it("decisionFromRow returns the row's own notationPlayed/notationBest columns verbatim", () => {
    // Deliberately different from what moveNotations(review) would derive
    // from this fixture's raw ("24/18" for both, confirmed earlier) — if
    // this still silently re-parsed raw instead of reading the column, the
    // assertions below would see "24/18", not these values, and fail.
    const decision = decisionFromRow(baseRow({ notationPlayed: "99/1", notationBest: "88/2" }));
    expect(decision?.myMoveNotation).toBe("99/1");
    expect(decision?.bestMoveNotation).toBe("88/2");
  });

  it("decisionFromRowForReplay returns the row's own notationPlayed/notationBest columns verbatim", () => {
    const decision = decisionFromRowForReplay(baseRow({ notationPlayed: "99/1", notationBest: "88/2" }));
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
        notationPlayed: null,
        notationBest: null,
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
        notationPlayed: null,
        notationBest: null,
        raw: cubeEvent,
      })
    );
    expect(decision?.myMoveNotation).toBeNull();
    expect(decision?.bestMoveNotation).toBeNull();
  });
});

describe("toDecisionListItems", () => {
  it("builds an item per row with its classification and match link", () => {
    const [item] = toDecisionListItems([row()], new Map());
    expect(item.classification).toBe("opening_game");
    expect(item.matchHref).toBe("/matches/46576635");
    expect(item.decision.id).toBe("1");
    expect(item.decision.gameIndex).toBe(3);
    expect(item.decision.severity).toBe("blunder");
    expect(item.decision.absError).toBeCloseTo(0.12);
    expect(item.decision.sourcePositionId).toBe("4HPwATDgc/ABMA");
  });

  it("takes the roll from the lookup, keyed by gameId:eventId", () => {
    const lookup = new Map([[`10:${event.id}`, [6, 2]]]);
    expect(toDecisionListItems([row()], lookup)[0].decision.roll).toEqual([6, 2]);
  });

  it("drops rows decisionFromRow can't build, keeping the rest in order", () => {
    const items = toDecisionListItems(
      [row({ id: 1 }), row({ id: 2, rawError: null }), row({ id: 3, raw: { reviews: [] } }), row({ id: 4 })],
      new Map()
    );
    expect(items.map((i) => i.decision.id)).toEqual(["1", "4"]);
  });

  it("returns an empty list for no rows", () => {
    expect(toDecisionListItems([], new Map())).toEqual([]);
  });
});
