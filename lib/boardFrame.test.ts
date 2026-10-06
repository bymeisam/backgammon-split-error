import { describe, expect, it } from "vitest";
import { boardPositionFlipped } from "@/lib/boardFrame";

describe("boardPositionFlipped", () => {
  it("no flip when neither reason holds (a move, default view)", () => {
    expect(boardPositionFlipped({ positionFromOpponent: false }, false)).toBe(false);
    expect(boardPositionFlipped({ positionFromOpponent: false }, undefined)).toBe(false);
  });

  it("a take/pass is flipped in the default view, so the receiver is at the bottom", () => {
    expect(boardPositionFlipped({ positionFromOpponent: true }, false)).toBe(true);
  });

  it("the replay's fixed-perspective flip of an opponent's move still flips", () => {
    expect(boardPositionFlipped({ positionFromOpponent: false }, true)).toBe(true);
  });

  it("fixed perspective on the opponent's take: the two cancel, the doubler (the user) stays at the bottom", () => {
    expect(boardPositionFlipped({ positionFromOpponent: true }, true)).toBe(false);
  });

  it("no decision -> follows the view flag", () => {
    expect(boardPositionFlipped(null, true)).toBe(true);
    expect(boardPositionFlipped(null, false)).toBe(false);
  });
});
