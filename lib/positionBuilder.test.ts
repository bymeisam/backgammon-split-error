import { describe, expect, it } from "vitest";
import {
  editChecker,
  emptyPosition,
  initialPositionBuilderState,
  checkerTotal,
  normalizeRoll,
  startingPosition,
  validateBuilderState,
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
