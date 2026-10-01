import { describe, expect, it } from "vitest";
import { toDecisionListItems, type DecisionListRow } from "@/lib/decisionFromRow";
import moneyGameMove from "./__fixtures__/galaxy-payloads/money-game-move.json";

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
    raw: event,
    classification: "opening_game",
    game: { gameIndex: 3, match: { sourceMatchId: "46576635" } },
    ...overrides,
  };
}

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
