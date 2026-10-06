import { describe, expect, it } from "vitest";
import { cubeSide, cubeStateFromMatchId, flipCubeState, type CubeState } from "@/lib/cubeState";
import { decodeGnuMatchId } from "@/lib/gnuMatchId";

describe("cubeSide", () => {
  it("centred -> center, owner at the bottom -> mine, otherwise opponent", () => {
    expect(cubeSide(null, 1)).toBe("center");
    expect(cubeSide(1, 1)).toBe("mine");
    expect(cubeSide(0, 1)).toBe("opponent");
  });
});

describe("cubeStateFromMatchId", () => {
  it("null for a missing/undecodable Match ID", () => {
    expect(cubeStateFromMatchId(null)).toBeNull();
  });

  it("A2's take (45282503 g2): the opponent's 2-cube is drawn beside the doubler (the opponent, at the bottom), not beside the receiver", () => {
    // ARmgAAAACAAE: cube owner white, dice owner white (the redoubler, drawn
    // at the bottom), turn black (the user, taking).
    expect(cubeStateFromMatchId(decodeGnuMatchId("ARmgAAAACAAE"))).toEqual({
      value: 2,
      owner: "mine",
      confident: true,
    });
  });

  it("A1 (45282503 g2, the user's move): the opponent's 2-cube is drawn on the opponent's side", () => {
    expect(cubeStateFromMatchId(decodeGnuMatchId("QQmxAAAACAAE"))).toEqual({
      value: 2,
      owner: "opponent",
      confident: true,
    });
  });

  it("centred cube", () => {
    expect(cubeStateFromMatchId(decodeGnuMatchId("MAGzAAAACAAE"))).toEqual({
      value: 1,
      owner: "center",
      confident: true,
    });
  });
});

describe("flipCubeState", () => {
  it("swaps mine <-> opponent", () => {
    const mine: CubeState = { value: 2, owner: "mine", confident: true };
    const opponent: CubeState = { value: 2, owner: "opponent", confident: true };
    expect(flipCubeState(mine)).toEqual({ value: 2, owner: "opponent", confident: true });
    expect(flipCubeState(opponent)).toEqual({ value: 2, owner: "mine", confident: true });
  });

  it("leaves center untouched", () => {
    const center: CubeState = { value: 1, owner: "center", confident: true };
    expect(flipCubeState(center)).toEqual(center);
  });

  it("is its own inverse", () => {
    const state: CubeState = { value: 4, owner: "mine", confident: true };
    expect(flipCubeState(flipCubeState(state))).toEqual(state);
  });
});
