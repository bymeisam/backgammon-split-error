import { describe, expect, it } from "vitest";
import {
  PlayerUserIds,
  actorPlayerFor,
  crawfordStateFor,
  decodeGnuMatchId,
  effectiveMatchLength,
  encodeGnuMatchId,
  gameScoreFromMatchId,
  gnuPlayerForColor,
  type DecodedMatchId,
} from "@/lib/gnuMatchId";

const BLACK = 1;
const WHITE = 0;

describe("decodeGnuMatchId — known vectors", () => {
  it("EgGgAAAACAAE: 4-cube owned by player 1 (black), 5-point, 0-1", () => {
    expect(decodeGnuMatchId("EgGgAAAACAAE")).toMatchObject({
      cubeValue: 4,
      cubeOwner: 1,
      matchLength: 5,
      score: [0, 1],
    });
  });

  it("MAGzAAAACAAE: centred 1-cube, 5-point, 0-1, dice 6-4", () => {
    expect(decodeGnuMatchId("MAGzAAAACAAE")).toMatchObject({
      cubeValue: 1,
      cubeOwner: null,
      matchLength: 5,
      score: [0, 1],
      dice: [6, 4],
    });
  });

  it("EgGgABAAAAAE: same cube, scores the other way round (1-0)", () => {
    expect(decodeGnuMatchId("EgGgABAAAAAE")).toMatchObject({
      cubeValue: 4,
      cubeOwner: 1,
      matchLength: 5,
      score: [1, 0],
    });
  });

  it("money games encode length 0", () => {
    for (const id of ["AQEAAAAAAAAA", "EQEAAAAAAAAA", "cAkAAAAAAAAA"]) {
      expect(decodeGnuMatchId(id)?.matchLength).toBe(0);
    }
    expect(decodeGnuMatchId("AQEAAAAAAAAA")).toMatchObject({ cubeValue: 2, cubeOwner: 0 });
    expect(decodeGnuMatchId("EQEAAAAAAAAA")).toMatchObject({ cubeValue: 2, cubeOwner: 1 });
    expect(decodeGnuMatchId("cAkAAAAAAAAA")).toMatchObject({ cubeValue: 1, cubeOwner: null });
  });
});

// The user's confirmations on Galaxy's site (reports/2026-10-06-examples-
// to-check.md). The user is black (player 1) in both matches — looked up in
// the local DB's CHECKER rows.
describe("decodeGnuMatchId — the user's Galaxy confirmations", () => {
  it("A1 (45282503 g2): a 2-cube on the opponent's (white) side", () => {
    expect(decodeGnuMatchId("QQmxAAAACAAE")).toMatchObject({ cubeValue: 2, cubeOwner: WHITE });
  });

  it("A2 (45282503 g2, opponent redoubles, user to take): a 2-cube owned by the opponent, double offered, user's turn", () => {
    expect(decodeGnuMatchId("ARmgAAAACAAE")).toMatchObject({
      cubeValue: 2,
      cubeOwner: WHITE,
      doubleOffered: true,
      turn: BLACK,
      diceOwner: WHITE,
    });
  });

  it("A3 (45282503 g2, resignation): a 4-cube on the user's side", () => {
    expect(decodeGnuMatchId("EgGgAAAACAAE")).toMatchObject({ cubeValue: 4, cubeOwner: BLACK });
  });

  it("A4 (30873806 g2): a 2-cube on the user's side", () => {
    expect(decodeGnuMatchId("EQGvABAAAAAE")).toMatchObject({ cubeValue: 2, cubeOwner: BLACK });
  });

  it("A5 (30873806 g5, user doubles): the user already owns a 2-cube, so this is a redouble to 4", () => {
    expect(decodeGnuMatchId("UQmgADAAEAAE")).toMatchObject({ cubeValue: 2, cubeOwner: BLACK, turn: BLACK });
  });

  it("H1 (47816592 g4's first decision): opp (white) 4, user (black) 2", () => {
    expect(decodeGnuMatchId("MIGuAEAAEAAE")?.score).toEqual([4, 2]);
  });

  it("H2 (45282503 g2's first decision): user (black) 1, opp (white) 0", () => {
    expect(decodeGnuMatchId("MAGzAAAACAAE")?.score).toEqual([0, 1]);
  });
});

describe("decodeGnuMatchId — invalid input", () => {
  it("returns null for missing, wrong-length or non-base64 input", () => {
    expect(decodeGnuMatchId(null)).toBeNull();
    expect(decodeGnuMatchId(undefined)).toBeNull();
    expect(decodeGnuMatchId("")).toBeNull();
    expect(decodeGnuMatchId("EgGgAAAACAA")).toBeNull();
    expect(decodeGnuMatchId("EgGgAAAACAAEE")).toBeNull();
    expect(decodeGnuMatchId("EgGgAAAA*AAE")).toBeNull();
  });

  it("returns null for cube-owner bits 2, which GNU never writes", () => {
    const base = decodeGnuMatchId("MAGzAAAACAAE")!;
    // owner bits 3 -> centred; craft bits 2 by hand: cube owner field = 2.
    const id = encodeGnuMatchId({ ...base, cubeOwner: 1 });
    const bytes = Buffer.from(id, "base64");
    bytes[0] = (bytes[0] & ~0x30) | 0x20;
    expect(decodeGnuMatchId(bytes.toString("base64"))).toBeNull();
  });
});

describe("encodeGnuMatchId", () => {
  it("round-trips every decoded field of the known vectors", () => {
    // Field-level, not string-level: Galaxy's match-play IDs also set a bit
    // above the 66 decoded ones (the ninth byte's 0x04), which the app
    // doesn't read and the encoder doesn't write.
    for (const id of ["EgGgAAAACAAE", "MAGzAAAACAAE", "EgGgABAAAAAE", "QQmxAAAACAAE", "ARmgAAAACAAE", "UQmgADAAEAAE", "MIGuAEAAEAAE", "cAkAAAAAAAAA"]) {
      const decoded = decodeGnuMatchId(id)!;
      expect(decodeGnuMatchId(encodeGnuMatchId(decoded))).toEqual(decoded);
    }
    expect(encodeGnuMatchId(decodeGnuMatchId("cAkAAAAAAAAA")!)).toBe("cAkAAAAAAAAA");
  });

  it("round-trips a large player-1 score that spills into the ninth byte", () => {
    const m: DecodedMatchId = {
      ...decodeGnuMatchId("MAGzAAAACAAE")!,
      matchLength: 25,
      score: [24, 20000],
    };
    expect(decodeGnuMatchId(encodeGnuMatchId(m))?.score).toEqual([24, 20000]);
  });
});

describe("crawfordStateFor", () => {
  const base = decodeGnuMatchId("MAGzAAAACAAE")!;

  it("money game -> none", () => {
    expect(crawfordStateFor({ ...base, matchLength: 0 })).toBe("none");
  });

  it("Crawford bit set -> crawford", () => {
    expect(crawfordStateFor({ ...base, matchLength: 7, crawford: true, score: [6, 2] })).toBe("crawford");
  });

  it("a player 1-away without the Crawford bit -> post_crawford", () => {
    expect(crawfordStateFor({ ...base, matchLength: 7, score: [6, 3] })).toBe("post_crawford");
  });

  it("nobody 1-away -> none", () => {
    expect(crawfordStateFor({ ...base, matchLength: 7, score: [5, 3] })).toBe("none");
  });

  it("1-point match -> none (no Crawford rule to apply)", () => {
    expect(crawfordStateFor({ ...base, matchLength: 1, score: [0, 0] })).toBe("none");
  });
});

describe("effectiveMatchLength — an even decoded length means money", () => {
  const base = decodeGnuMatchId("MAGzAAAACAAE")!;

  it("odd lengths pass through; 0 stays money", () => {
    for (const length of [1, 3, 5, 7, 25]) expect(effectiveMatchLength({ ...base, matchLength: length })).toBe(length);
    expect(effectiveMatchLength({ ...base, matchLength: 0 })).toBe(0);
  });

  it("even lengths are money: 8 (72588, 72587, 72577, 19719) and 16 (249289)", () => {
    expect(effectiveMatchLength({ ...base, matchLength: 8 })).toBe(0);
    expect(effectiveMatchLength({ ...base, matchLength: 16 })).toBe(0);
    expect(effectiveMatchLength({ ...base, matchLength: 2 })).toBe(0);
  });

  it("the raw decoder still returns the literal length bits", () => {
    const id = encodeGnuMatchId({ ...base, matchLength: 8 });
    expect(decodeGnuMatchId(id)?.matchLength).toBe(8);
  });

  it("crawfordStateFor treats an even length as money (none), even with a player at length - 1", () => {
    expect(crawfordStateFor({ ...base, matchLength: 8, score: [7, 0] })).toBe("none");
    expect(crawfordStateFor({ ...base, matchLength: 16, crawford: true, score: [15, 0] })).toBe("none");
  });

  it("gameScoreFromMatchId: even length -> scores and Crawford null, like length 0", () => {
    const players = new PlayerUserIds();
    players.add("me", BLACK);
    players.add("opp", WHITE);
    const money = { crawfordState: null, userScore: null, opponentScore: null };
    expect(gameScoreFromMatchId({ ...base, matchLength: 8, score: [0, 0] }, players, "me")).toEqual(money);
    expect(gameScoreFromMatchId({ ...base, matchLength: 16, score: [0, 0] }, players, "me")).toEqual(money);
    expect(gameScoreFromMatchId({ ...base, matchLength: 0 }, players, "me")).toEqual(money);
    expect(gameScoreFromMatchId({ ...base, matchLength: 5, score: [0, 1] }, players, "me")).toEqual({
      crawfordState: "none",
      userScore: 1,
      opponentScore: 0,
    });
  });
});

describe("gnuPlayerForColor / actorPlayerFor", () => {
  it("black = player 1, white = player 0, anything else unknown", () => {
    expect(gnuPlayerForColor("black")).toBe(1);
    expect(gnuPlayerForColor("white")).toBe(0);
    expect(gnuPlayerForColor("")).toBeNull();
  });

  it("move -> dice owner; cube_double/cube_pass -> turn; resignation -> unknown", () => {
    const pass = decodeGnuMatchId("ARmgAAAACAAE")!; // dice owner white, turn black
    expect(actorPlayerFor("move", pass)).toBe(WHITE);
    expect(actorPlayerFor("cube_pass", pass)).toBe(BLACK);
    expect(actorPlayerFor("cube_double", pass)).toBe(BLACK);
    expect(actorPlayerFor("resignation", pass)).toBeNull();
  });
});

describe("PlayerUserIds", () => {
  it("resolves both seats from direct evidence", () => {
    const p = new PlayerUserIds();
    p.add("me", BLACK);
    p.add("opp", WHITE);
    expect(p.userIdFor(BLACK)).toBe("me");
    expect(p.userIdFor(WHITE)).toBe("opp");
    expect(p.playerFor("me")).toBe(BLACK);
  });

  it("fills a missing seat with the one other userId seen", () => {
    const p = new PlayerUserIds();
    p.add("me", BLACK);
    p.add("opp", null);
    expect(p.userIdFor(WHITE)).toBe("opp");
    expect(p.playerFor("opp")).toBe(WHITE);
  });

  it("puts an unseen user in the remaining seat", () => {
    const p = new PlayerUserIds();
    p.add("opp", WHITE);
    expect(p.playerFor("me")).toBe(BLACK);
  });

  it("returns null on contradictory evidence", () => {
    const p = new PlayerUserIds();
    p.add("a", BLACK);
    p.add("b", BLACK);
    expect(p.userIdFor(BLACK)).toBeNull();
  });
});
