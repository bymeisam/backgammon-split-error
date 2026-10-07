import { describe, expect, it } from "vitest";
import {
  cubeListValue,
  cubeSide,
  cubeStateFromMatchId,
  doubleOfferFor,
  doubleOfferLabel,
  flipCubeState,
  positionFromOpponent,
  type CubeState,
} from "@/lib/cubeState";
import { decodeGnuMatchId, encodeGnuMatchId } from "@/lib/gnuMatchId";

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

describe("positionFromOpponent", () => {
  it("a take/pass whose Match ID has dice owner != turn (A2) is drawn from the doubler's side", () => {
    expect(positionFromOpponent("cube_pass", decodeGnuMatchId("ARmgAAAACAAE"))).toBe(true);
  });

  it("a cube_pass whose Match ID has dice owner == turn is not flipped", () => {
    const m = decodeGnuMatchId("ARmgAAAACAAE")!;
    const same = decodeGnuMatchId(encodeGnuMatchId({ ...m, turn: m.diceOwner }));
    expect(positionFromOpponent("cube_pass", same)).toBe(false);
  });

  it("a cube_pass with no Match ID falls back to the doubler's side", () => {
    expect(positionFromOpponent("cube_pass", null)).toBe(true);
  });

  it("moves, doubles and resignations are drawn from the actor's side", () => {
    const m = decodeGnuMatchId("ARmgAAAACAAE");
    expect(positionFromOpponent("move", m)).toBe(false);
    expect(positionFromOpponent("cube_double", m)).toBe(false);
    expect(positionFromOpponent("resignation", m)).toBe(false);
  });
});

describe("doubleOfferFor", () => {
  it("A2: the opponent's 2-cube redoubled -> offered 4, a redouble", () => {
    expect(doubleOfferFor("cube_pass", decodeGnuMatchId("ARmgAAAACAAE"), true)).toEqual({
      value: 4,
      redouble: true,
      took: true,
    });
  });

  it("a centred cube -> an initial double to 2", () => {
    expect(doubleOfferFor("cube_pass", decodeGnuMatchId("MAGzAAAACAAE"), false)).toEqual({
      value: 2,
      redouble: false,
      took: false,
    });
  });

  it("null off cube_pass, or with no Match ID", () => {
    expect(doubleOfferFor("cube_double", decodeGnuMatchId("ARmgAAAACAAE"), null)).toBeNull();
    expect(doubleOfferFor("cube_pass", null, true)).toBeNull();
  });
});

describe("doubleOfferLabel", () => {
  it("the user takes the opponent's redouble", () => {
    expect(doubleOfferLabel({ value: 4, redouble: true, took: true }, true, "black")).toBe(
      "Opponent redoubles to 4: you took"
    );
  });

  it("the opponent passes the user's double", () => {
    expect(doubleOfferLabel({ value: 2, redouble: false, took: false }, false, "white")).toBe(
      "You double to 2: opponent passed"
    );
  });

  it("the user redoubles and the opponent takes", () => {
    expect(doubleOfferLabel({ value: 4, redouble: true, took: true }, false, "white")).toBe(
      "You redouble to 4: opponent took"
    );
  });

  it("unknown user -> colours; unknown response -> the offer alone", () => {
    expect(doubleOfferLabel({ value: 2, redouble: false, took: true }, null, "black")).toBe(
      "White doubles to 2: Black took"
    );
    expect(doubleOfferLabel({ value: 8, redouble: true, took: null }, true, "black")).toBe(
      "Opponent redoubles to 8"
    );
  });
});

describe("cubeListValue — the cube square in the decision lists", () => {
  const centred = decodeGnuMatchId("MAGzAAAACAAE"); // cube 1, centred
  const owned2 = decodeGnuMatchId("ARmgAAAACAAE"); // cube 2, owned

  it("a take/pass shows the offered value (twice the cube entering the decision)", () => {
    expect(cubeListValue("cube_pass", owned2, null)).toBe(4);
    expect(cubeListValue("cube_pass", centred, null)).toBe(2);
  });

  it("a double shows the offered value — never below 2", () => {
    expect(cubeListValue("cube_double", centred, true)).toBe(2);
    expect(cubeListValue("cube_double", owned2, true)).toBe(4);
  });

  it("a no-double check shows the current cube", () => {
    expect(cubeListValue("cube_double", centred, false)).toBe(1);
    expect(cubeListValue("cube_double", owned2, null)).toBe(2);
  });

  it("null for a checker move, a resignation, or no Match ID", () => {
    expect(cubeListValue("move", owned2, null)).toBeNull();
    expect(cubeListValue("resignation", owned2, null)).toBeNull();
    expect(cubeListValue("cube_pass", null, true)).toBeNull();
  });
});
