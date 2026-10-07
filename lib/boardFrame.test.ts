import { describe, expect, it } from "vitest";
import { boardCubeFor, boardPositionFlipped } from "@/lib/boardFrame";

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

describe("boardCubeFor", () => {
  const owned = { value: 2, owner: "mine" as const, confident: true };

  it("a move: the owned cube, beside its owner", () => {
    expect(
      boardCubeFor({ cubeState: owned, doubleOffer: null, positionFromOpponent: false }, false)
    ).toEqual({ kind: "owned", value: 2, owner: "mine" });
  });

  it("the owned cube flips with the position (fixed perspective on an opponent's move)", () => {
    expect(
      boardCubeFor({ cubeState: owned, doubleOffer: null, positionFromOpponent: false }, true)
    ).toEqual({ kind: "owned", value: 2, owner: "opponent" });
  });

  it("a take/pass (45282503 g2 Move 16): the offered 4 at the receiver's (bottom) edge, not the current 2", () => {
    expect(
      boardCubeFor(
        {
          cubeState: { value: 2, owner: "opponent", confident: true },
          doubleOffer: { value: 4, redouble: true, took: true },
          positionFromOpponent: true,
        },
        false
      )
    ).toEqual({ kind: "offered", value: 4, side: "mine" });
  });

  it("fixed perspective on the opponent's take: the receiver (the opponent) is at the top", () => {
    expect(
      boardCubeFor(
        {
          cubeState: { value: 1, owner: "center", confident: true },
          doubleOffer: { value: 2, redouble: false, took: false },
          positionFromOpponent: true,
        },
        true
      )
    ).toEqual({ kind: "offered", value: 2, side: "opponent" });
  });

  it("no cube without a confident state, or without a decision", () => {
    expect(
      boardCubeFor({ cubeState: { ...owned, confident: false }, doubleOffer: null, positionFromOpponent: false }, false)
    ).toBeNull();
    expect(boardCubeFor({ cubeState: null, doubleOffer: null, positionFromOpponent: false }, false)).toBeNull();
    expect(boardCubeFor(null, false)).toBeNull();
  });
});
