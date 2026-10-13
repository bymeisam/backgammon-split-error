import { describe, expect, it } from "vitest";
import { encodeGnuMatchId, type DecodedMatchId } from "./gnuMatchId";
import { decodeForumPosition, forumPositionCaption } from "./forumPosition";

const base: DecodedMatchId = {
  cubeValue: 1,
  cubeOwner: null,
  diceOwner: 1,
  crawford: false,
  gameState: 1,
  turn: 1,
  doubleOffered: false,
  resignationOffered: 0,
  dice: [4, 6],
  matchLength: 5,
  score: [3, 1],
};

describe("forumPositionCaption", () => {
  it("money game: no score, no Crawford", () => {
    expect(forumPositionCaption({ ...base, matchLength: 0 }, "CHECKER")).toBe("Money game · 6-4 to play");
  });

  it("an even decoded length is a money game too", () => {
    expect(forumPositionCaption({ ...base, matchLength: 8 }, "CHECKER")).toBe("Money game · 6-4 to play");
  });

  it("match: the player on roll's score first, higher die first", () => {
    expect(forumPositionCaption(base, "CHECKER")).toBe("5-point match · 1–3 · 6-4 to play");
    expect(forumPositionCaption({ ...base, diceOwner: 0 }, "CHECKER")).toBe("5-point match · 3–1 · 6-4 to play");
  });

  it("Crawford game", () => {
    expect(forumPositionCaption({ ...base, crawford: true, score: [4, 2] }, "CHECKER")).toBe(
      "5-point match · 2–4 · Crawford · 6-4 to play",
    );
  });

  it("post-Crawford game", () => {
    expect(forumPositionCaption({ ...base, score: [4, 3] }, "CHECKER")).toBe(
      "5-point match · 3–4 · post-Crawford · 6-4 to play",
    );
  });

  it("cube decision", () => {
    expect(forumPositionCaption({ ...base, dice: [0, 0] }, "CUBE")).toBe("5-point match · 1–3 · Cube decision");
    expect(forumPositionCaption({ ...base, matchLength: 0 }, "CUBE")).toBe("Money game · Cube decision");
  });
});

describe("decodeForumPosition", () => {
  it("returns null for an invalid Match ID", () => {
    expect(decodeForumPosition("4HPwATDgc/ABMA", "nonsense", "CHECKER")).toBeNull();
  });

  it("decodes the board, the cube from the on-roll player's side, and the roll", () => {
    const decoded = decodeForumPosition("4HPwATDgc/ABMA", encodeGnuMatchId({ ...base, cubeValue: 2, cubeOwner: 1 }), "CHECKER");
    expect(decoded?.position.mine[5]).toBe(5);
    expect(decoded?.cube).toEqual({ kind: "owned", value: 2, owner: "mine" });
    expect(decoded?.dice).toEqual([6, 4]);
    const cube = decodeForumPosition("4HPwATDgc/ABMA", encodeGnuMatchId({ ...base, cubeValue: 2, cubeOwner: 0 }), "CUBE");
    expect(cube?.cube).toEqual({ kind: "owned", value: 2, owner: "opponent" });
    expect(cube?.dice).toEqual([]);
  });
});
