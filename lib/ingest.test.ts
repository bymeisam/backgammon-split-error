// Regression tests for lib/ingest.ts's event-processing decisions, pinned
// against fixture payloads (lib/__fixtures__/galaxy-payloads/) shaped like
// real Galaxy game_reviews responses — each fixture reconstructs one edge
// case already hit and fixed during this project's history (see
// PROGRESS.md / docs/field-mapping.md), so a future refactor that
// reintroduces one of these bugs fails a test immediately instead of
// silently shipping. Prisma and the Galaxy client are both mocked — no
// live DB or network call, pure processing-logic verification.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GameEvent, GameReviewsResponse } from "@/lib/gameReviewsTypes";
import type { MatchIndexData } from "@/lib/ingest";
import { Prisma } from "@/lib/generated/prisma/client";
import { decodeGnuMatchId, encodeGnuMatchId, type DecodedMatchId } from "@/lib/gnuMatchId";

import forcedMoveNotCounted from "./__fixtures__/galaxy-payloads/forced-move-not-counted.json";
import doubleRejectedNullAnalysis from "./__fixtures__/galaxy-payloads/double-rejected-null-analysis.json";
import lowConfidenceDoubtful from "./__fixtures__/galaxy-payloads/low-confidence-doubtful.json";
import moneyGameMove from "./__fixtures__/galaxy-payloads/money-game-move.json";
import resignation from "./__fixtures__/galaxy-payloads/resignation.json";
import gameStartedGameOver from "./__fixtures__/galaxy-payloads/game-started-game-over.json";

// vi.mock calls below are hoisted above these imports by Vitest's
// transform, so ingestMatch (and the prisma/galaxy-client modules it
// imports internally) already sees the mocked versions.

// vi.mock factories below are hoisted above these declarations at runtime,
// so the mock fns they close over must be created via vi.hoisted (hoisted
// together with them) rather than plain top-level consts.
const {
  decisionUpsert,
  matchUpsert,
  matchUpdate,
  gameUpsert,
  gameUpdate,
  playerIdentityFindFirst,
  playerIdentityUpsert,
  getGameReviews,
} = vi.hoisted(() => ({
  decisionUpsert: vi.fn(async ({ create }: { create: Record<string, unknown> }) => ({
    id: 1,
    ...create,
  })),
  matchUpsert: vi.fn<
    (args: { where: unknown; create: Record<string, unknown>; update: Record<string, unknown> }) => Promise<{ id: number }>
  >(async () => ({ id: 1 })),
  matchUpdate: vi.fn<(args: { where: unknown; data: Record<string, unknown> }) => Promise<object>>(
    async () => ({})
  ),
  gameUpsert: vi.fn(async () => ({ id: 1 })),
  gameUpdate: vi.fn<(args: { where: unknown; data: Record<string, unknown> }) => Promise<object>>(
    async () => ({})
  ),
  playerIdentityFindFirst: vi.fn<() => Promise<{ sourceUserId: string } | null>>(async () => null),
  playerIdentityUpsert: vi.fn(async () => ({})),
  getGameReviews: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    match: { upsert: matchUpsert, update: matchUpdate },
    playerIdentity: { findFirst: playerIdentityFindFirst, upsert: playerIdentityUpsert },
    game: { upsert: gameUpsert, update: gameUpdate },
    decision: { upsert: decisionUpsert },
  },
}));

vi.mock("@/lib/galaxy-client", () => ({
  createGalaxyClient: () => ({ listMatches: vi.fn(), getGameReviews }),
}));

import { ingestMatch, parseMatchIndexData } from "@/lib/ingest";

const indexData: MatchIndexData = {
  opponentName: "Test Opponent",
  opponentCountry: "US",
  opponentRating: 1500,
  opponentError: 5,
  opponentScore: 2,
  userError: 4,
  userRating: 1600,
  userScore: 3,
};

// Serves `fixture` for game 1, then null (end of match) for every game
// after — ingestMatch loops gameIndex 1..MAX_GAMES until it gets null back.
function serveSingleGame(fixture: GameReviewsResponse) {
  getGameReviews.mockImplementation(async (_matchId: number, gameIndex: number) =>
    gameIndex === 1 ? fixture : null
  );
}

const PROBABILITIES = {
  lose: 0.5,
  lose_backgammon: 0,
  lose_gammon: 0,
  win: 0.5,
  win_backgammon: 0,
  win_gammon: 0,
  mwc_context: null,
  mwc: null,
  volatility: null,
  market_losing_probability: null,
  market_gaining_probability: null,
};

const ERROR_ANALYSIS_NONE = {
  raw_error: 0,
  luck_mwc: null,
  mwc_error: 0,
  luck: 0,
  equity_error: null,
  error_severity: "none" as const,
  is_blunder: false,
  is_error: false,
};

// A GNU Match ID for a test event: a centred 1-cube, 7-point match at 0-0,
// player 1 (black) on roll, with `overrides` applied. See lib/gnuMatchId.ts.
const BASE_MATCH_STATE = decodeGnuMatchId("MAGzAAAACAAE")!;
function mid(overrides: Partial<DecodedMatchId> = {}): string {
  return encodeGnuMatchId({
    ...BASE_MATCH_STATE,
    matchLength: 7,
    score: [0, 0],
    diceOwner: 1,
    turn: 1,
    ...overrides,
  });
}

// Minimal but structurally complete CHECKER ("move") event — enough for
// ingestMatch to fully process it into a Decision row, used to build
// multi-event fixtures inline (for the plyNumber test below) rather than a
// full JSON fixture file, since only eventId/event_type/analysed_event/
// error_analysis actually vary across cases.
function moveEvent(
  id: number,
  opts: {
    errorAnalysisNull?: boolean;
    userId?: string;
    // Mirrors the real, confirmed-unreliable shape: a subset of
    // move_commited events report both scores and match_length as null
    // while sibling events in the same game report the real value (see
    // reports/2026-10-02-raw-field-reverification.md) — scores/match_length
    // are 100% correlated, so this flag nulls both together, never just one.
    scoresNull?: boolean;
    scores?: { black: number; white: number };
    color?: "black" | "white" | "";
    // GNU Match ID (reviews[0].source_match.formatted_value); null = none.
    matchId?: string | null;
  } = {}
): GameEvent {
  return {
    id,
    color: opts.color ?? "white",
    user_id: opts.userId ?? "user_me",
    moves: [],
    event_type: "move_commited",
    rolled_dice: [],
    reviews: [
      {
        id: id + 1_000_000,
        second: 1,
        take: null,
        level: 2,
        double: null,
        threshold: null,
        source_match: (() => {
          // Default: a centred cube with white (this helper's default
          // colour) on roll; null = no Match ID at all.
          const value = opts.matchId === undefined ? mid({ diceOwner: 0, turn: 0 }) : opts.matchId;
          return value ? { id: 1, formatted_value: value } : null;
        })(),
        resigned_points: null,
        source_position: { id: 1, classification: "opening_game", formatted_value: "pos" },
        destination_position: null,
        result: {
          version: "1.0",
          analysed_event: "move",
          result: {
            equity: 0,
            metadata: {
              timestamp: "2026-09-18T02:49:15.400013Z",
              analysis_level: 2,
              analysis_time_ms: 5,
              crawford_state: "none",
              match_length: opts.scoresNull ? null : 7,
              scores: opts.scoresNull ? null : opts.scores ?? { black: 0, white: 0 },
              count_as_decision: true,
              request_id: null,
              max_move: null,
            },
            probabilities: PROBABILITIES,
            error_analysis: opts.errorAnalysisNull ? null : ERROR_ANALYSIS_NONE,
            moves: [
              {
                level: 2,
                final: { xgid: "x", gnubgid: "g" },
                notation: "13/7",
                rank: 1,
                equity: 0,
                probabilities: PROBABILITIES,
                error_analysis: ERROR_ANALYSIS_NONE,
                move_played: true,
              },
            ],
          },
        },
      },
    ],
  } as unknown as GameEvent;
}

function gameReviewsResponse(events: GameEvent[]): GameReviewsResponse {
  return { data: { events, match_id: 1, game_index: 1 }, type: "game_events" };
}

// Minimal dice_rolled event, reviewed as its own cube-check ("should you
// have doubled before this roll") — the real shape that becomes its own
// CUBE-kind Decision row (see Decision.roll's own schema comment / the
// Step 4 design report for why this row's backward scan looks PAST its own
// roll by design, not AT it).
function diceRolledEvent(id: number, rolledDice: number[]): GameEvent {
  return {
    id,
    color: "white",
    user_id: "user_me",
    moves: [],
    event_type: "dice_rolled",
    rolled_dice: rolledDice,
    reviews: [
      {
        id: id + 1_000_000,
        second: 1,
        take: null,
        level: 2,
        double: false,
        threshold: null,
        source_match: null,
        resigned_points: null,
        source_position: { id: 1, classification: "opening_game", formatted_value: "pos" },
        destination_position: null,
        result: {
          version: "1.0",
          analysed_event: "cube_double",
          result: {
            equity: 0,
            metadata: {
              timestamp: "2026-09-18T02:49:15.400013Z",
              analysis_level: 2,
              analysis_time_ms: 5,
              crawford_state: "none",
              match_length: 7,
              scores: { black: 0, white: 0 },
              count_as_decision: false,
              request_id: null,
              max_move: null,
            },
            probabilities: PROBABILITIES,
            error_analysis: ERROR_ANALYSIS_NONE,
            cube_analysis: { doublers_best_action: "no_double", receivers_best_action: "pass" },
          },
        },
      },
    ],
  } as unknown as GameEvent;
}

// A real double offer (review.double: true) — as opposed to diceRolledEvent
// above's routine "did not double" check.
function doubleEvent(id: number, userId: string, matchId: string | null = null): GameEvent {
  return {
    id,
    // Real CUBE events carry an empty colour.
    color: "",
    user_id: userId,
    moves: [],
    event_type: "double_requested",
    rolled_dice: [],
    reviews: [
      {
        id: id + 1_000_000,
        second: 1,
        take: null,
        level: 2,
        double: true,
        threshold: null,
        source_match: matchId ? { id: 1, formatted_value: matchId } : null,
        resigned_points: null,
        source_position: { id: 1, classification: "opening_game", formatted_value: "pos" },
        destination_position: null,
        result: {
          version: "1.0",
          analysed_event: "cube_double",
          result: {
            equity: 0,
            metadata: {
              timestamp: "2026-09-18T02:49:15.400013Z",
              analysis_level: 2,
              analysis_time_ms: 5,
              crawford_state: "none",
              match_length: 7,
              scores: { black: 0, white: 0 },
              count_as_decision: true,
              request_id: null,
              max_move: null,
            },
            probabilities: PROBABILITIES,
            error_analysis: ERROR_ANALYSIS_NONE,
            cube_analysis: {
              doublers_best_action: "double",
              receivers_best_action: "take",
              no_double: 0.7922,
              double_take: 0.9751,
              double_pass: 1,
            },
          },
        },
      },
    ],
  } as unknown as GameEvent;
}

// The receiver's take/pass response to a double offer.
function cubePassEvent(id: number, userId: string, taken: boolean, matchId: string | null = null): GameEvent {
  return {
    id,
    // Real CUBE events carry an empty colour.
    color: "",
    user_id: userId,
    moves: [],
    event_type: taken ? "double_accepted" : "double_rejected",
    rolled_dice: [],
    reviews: [
      {
        id: id + 1_000_000,
        second: 1,
        take: taken,
        level: 2,
        double: null,
        threshold: null,
        source_match: matchId ? { id: 1, formatted_value: matchId } : null,
        resigned_points: null,
        source_position: { id: 1, classification: "opening_game", formatted_value: "pos" },
        destination_position: null,
        result: {
          version: "1.0",
          analysed_event: "cube_pass",
          result: {
            equity: 0,
            metadata: {
              timestamp: "2026-09-18T02:49:15.400013Z",
              analysis_level: 2,
              analysis_time_ms: 5,
              crawford_state: "none",
              match_length: 7,
              scores: { black: 0, white: 0 },
              count_as_decision: true,
              request_id: null,
              max_move: null,
            },
            probabilities: PROBABILITIES,
            error_analysis: ERROR_ANALYSIS_NONE,
            // Receiver rows are stored in the receiver's view (DP = -1), as
            // on nearly every real cube_pass row.
            cube_analysis: {
              doublers_best_action: "double",
              receivers_best_action: "take",
              no_double: -0.3838,
              double_take: -0.2057,
              double_pass: -1,
            },
          },
        },
      },
    ],
  } as unknown as GameEvent;
}

beforeEach(() => {
  decisionUpsert.mockClear();
  matchUpsert.mockClear();
  matchUpdate.mockClear();
  gameUpsert.mockClear();
  gameUpdate.mockClear();
  playerIdentityFindFirst.mockClear();
  playerIdentityUpsert.mockClear();
  getGameReviews.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("ingestMatch", () => {
  it("stores a Decision row for a count_as_decision:false event with a real (non-null) error_analysis", async () => {
    serveSingleGame(forcedMoveNotCounted as unknown as GameReviewsResponse);

    const summary = await ingestMatch(90000001, indexData, "token");

    expect(summary.decisionsIngested).toBe(1);
    expect(summary.decisionsSkippedNotCounted).toBe(1);
    expect(decisionUpsert).toHaveBeenCalledTimes(1);
    const create = decisionUpsert.mock.calls[0][0].create;
    expect(create.countAsDecision).toBe(false);
    expect(create.kind).toBe("CHECKER");
  });

  it("does NOT store a row for a count_as_decision:false event with a null error_analysis (double_rejected)", async () => {
    serveSingleGame(doubleRejectedNullAnalysis as unknown as GameReviewsResponse);

    const summary = await ingestMatch(90000002, indexData, "token");

    expect(summary.decisionsIngested).toBe(0);
    expect(decisionUpsert).not.toHaveBeenCalled();
    // Confirmed-safe skip (double_rejected is in the known-safe list) —
    // should be silent, not a warning.
    expect(summary.warnings).toHaveLength(0);
    expect(summary.errors).toHaveLength(0);
  });

  it("stores a row with rawError: null for a low-confidence (analysis_level: 1) doubtful decision", async () => {
    serveSingleGame(lowConfidenceDoubtful as unknown as GameReviewsResponse);

    const summary = await ingestMatch(90000003, indexData, "token");

    expect(summary.decisionsIngested).toBe(1);
    const create = decisionUpsert.mock.calls[0][0].create;
    expect(create.rawError).toBeNull();
    expect(create.errorSeverity).toBe("DOUBTFUL");
    expect(create.kind).toBe("CUBE");
  });

  it("handles a money-game match (Match ID length 0): Match.matchLength 0, Game score/crawford null", async () => {
    playerIdentityFindFirst.mockResolvedValueOnce({ sourceUserId: "user_me" });
    const fixture = structuredClone(moneyGameMove) as unknown as GameReviewsResponse;
    fixture.data.events[0].reviews[0].source_match = { id: 1, formatted_value: "cAkAAAAAAAAA" };
    serveSingleGame(fixture);

    const summary = await ingestMatch(90000004, indexData, "token");

    expect(summary.errors).toHaveLength(0);
    expect(summary.warnings).toHaveLength(0);
    expect(summary.decisionsIngested).toBe(1);
    const create = decisionUpsert.mock.calls[0][0].create;
    expect(create).not.toHaveProperty("matchScoreBlack");
    expect(create).not.toHaveProperty("matchScoreWhite");
    expect(create).not.toHaveProperty("crawfordState");

    const scoreUpdateCall = gameUpdate.mock.calls.find((call) => "userScore" in call[0].data);
    expect(scoreUpdateCall![0].data).toEqual({ userScore: null, opponentScore: null, crawfordState: null });

    expect(matchUpdate).toHaveBeenCalledTimes(1);
    expect(matchUpdate.mock.calls[0][0].data).toMatchObject({ matchLength: 0 });
    expect(matchUpdate.mock.calls[0][0].data).toHaveProperty("playedAt");
  });

  it("an even decoded length is money (72588-shaped, length 8): Match.matchLength 0, Game score/crawford null", async () => {
    playerIdentityFindFirst.mockResolvedValueOnce({ sourceUserId: "user_me" });
    serveSingleGame(
      gameReviewsResponse([
        moveEvent(10, { userId: "user_me", color: "black", matchId: mid({ matchLength: 8, score: [0, 0] }) }),
      ])
    );

    await ingestMatch(90000012, indexData, "token");

    const scoreUpdateCall = gameUpdate.mock.calls.find((call) => "userScore" in call[0].data);
    expect(scoreUpdateCall![0].data).toEqual({ userScore: null, opponentScore: null, crawfordState: null });
    expect(matchUpdate.mock.calls[0][0].data).toMatchObject({ matchLength: 0 });
  });

  it("a game whose first decision has no Match ID sets no score/crawford/matchLength, and warns", async () => {
    serveSingleGame(moneyGameMove as unknown as GameReviewsResponse);

    const summary = await ingestMatch(90000004, indexData, "token");

    expect(summary.errors).toHaveLength(0);
    expect(summary.warnings).toHaveLength(1);
    expect(gameUpdate).toHaveBeenCalledTimes(1);
    expect(gameUpdate.mock.calls[0][0].data).not.toHaveProperty("userScore");
    expect(matchUpdate.mock.calls[0][0].data).not.toHaveProperty("matchLength");
  });

  it("Game.userScore/opponentScore come from the first decision's Match ID through the user's seat — user black (H2: 45282503 g2)", async () => {
    playerIdentityFindFirst.mockResolvedValueOnce({ sourceUserId: "user_me" });
    // MAGzAAAACAAE: 5-point, player 0 (white) 0, player 1 (black) 1. The
    // user is black. metadata.scores is deliberately misleading (it's the
    // on-roll player's score, not the actor's) — no longer read.
    serveSingleGame(
      gameReviewsResponse([
        moveEvent(20, { userId: "user_opp", color: "white", matchId: mid({ diceOwner: 0, turn: 0, score: [0, 1], matchLength: 5 }) }),
        moveEvent(10, { userId: "user_me", color: "black", matchId: "MAGzAAAACAAE", scores: { black: 0, white: 1 } }),
      ])
    );

    await ingestMatch(90000011, indexData, "token");

    const scoreUpdateCall = gameUpdate.mock.calls.find((call) => "userScore" in call[0].data);
    expect(scoreUpdateCall![0].data).toEqual({ userScore: 1, opponentScore: 0, crawfordState: "none" });
    expect(matchUpdate.mock.calls[0][0].data).toMatchObject({ matchLength: 5 });
  });

  it("Game.userScore/opponentScore — user white, Crawford game", async () => {
    playerIdentityFindFirst.mockResolvedValueOnce({ sourceUserId: "user_me" });
    serveSingleGame(
      gameReviewsResponse([
        moveEvent(10, {
          userId: "user_me",
          color: "white",
          matchId: mid({ diceOwner: 0, turn: 0, score: [6, 3], crawford: true }),
        }),
        moveEvent(20, { userId: "user_opp", color: "black", matchId: mid({ score: [6, 3], crawford: true }) }),
      ])
    );

    await ingestMatch(90000016, indexData, "token");

    const scoreUpdateCall = gameUpdate.mock.calls.find((call) => "userScore" in call[0].data);
    expect(scoreUpdateCall![0].data).toEqual({ userScore: 6, opponentScore: 3, crawfordState: "crawford" });
  });

  it("Game crawford/scores without an isMe row: crawford set, scores left untouched", async () => {
    serveSingleGame(
      gameReviewsResponse([moveEvent(10, { userId: "user_me", color: "black", matchId: mid({ score: [3, 6] }) })])
    );

    await ingestMatch(90000017, indexData, "token");

    const call = gameUpdate.mock.calls.find((c) => "crawfordState" in c[0].data);
    expect(call![0].data).toEqual({ crawfordState: "post_crawford" });
  });

  it("stores a RESIGNATION decision with the resign-specific fields populated", async () => {
    serveSingleGame(resignation as unknown as GameReviewsResponse);

    const summary = await ingestMatch(90000005, indexData, "token");

    expect(summary.decisionsIngested).toBe(1);
    const create = decisionUpsert.mock.calls[0][0].create;
    expect(create.kind).toBe("RESIGNATION");
    expect(create.resignError).toBe(0.15);
    expect(create.shouldResign).toBe(true);
    expect(create.resignationType).toBe("gammon");
    expect(create.equityBefore).toBe(-0.8);
    expect(create.equityAfter).toBe(-1);
  });

  it("populates sourcePositionId from source_position.formatted_value", async () => {
    serveSingleGame(gameReviewsResponse([moveEvent(1)]));

    const summary = await ingestMatch(90000008, indexData, "token");

    expect(summary.decisionsIngested).toBe(1);
    const create = decisionUpsert.mock.calls[0][0].create;
    expect(create.sourcePositionId).toBe("pos");
  });

  it("roll: null for a game's genuinely first stored decision (no roll precedes it at all)", async () => {
    serveSingleGame(gameReviewsResponse([moveEvent(1)]));

    await ingestMatch(90000009, indexData, "token");

    expect(decisionUpsert.mock.calls[0][0].create.roll).toBe(Prisma.DbNull);
  });

  it("roll: the preceding dice_rolled event's own roll, for a CHECKER move", async () => {
    serveSingleGame(gameReviewsResponse([diceRolledEvent(10, [3, 4]), moveEvent(20)]));

    await ingestMatch(90000010, indexData, "token");

    const rollByEventId = new Map(
      decisionUpsert.mock.calls.map(([{ create }]) => [Number(create.eventId), create.roll])
    );
    expect(rollByEventId.get(20)).toEqual([3, 4]);
  });

  it("roll: null for a dice_rolled event's own cube-check row — the backward scan looks PAST its own roll by design, faithfully replicated here rather than fixed", async () => {
    serveSingleGame(gameReviewsResponse([diceRolledEvent(10, [3, 4])]));

    await ingestMatch(90000011, indexData, "token");

    // Nothing precedes event 10 at all, so its own roll ([3,4]) is never
    // surfaced — same as today's real DB-row read paths (see Decision.roll's
    // schema comment / reports/2026-10-02-step4-dice-roll-column-design.md).
    expect(decisionUpsert.mock.calls[0][0].create.roll).toBe(Prisma.DbNull);
  });

  it("roll: a LATER dice_rolled event resolves to the PRECEDING roll, not its own — confirms the backward-scan-past-itself quirk, not just a null case", async () => {
    serveSingleGame(
      gameReviewsResponse([diceRolledEvent(10, [3, 4]), moveEvent(20), diceRolledEvent(30, [5, 2])])
    );

    await ingestMatch(90000012, indexData, "token");

    const rollByEventId = new Map(
      decisionUpsert.mock.calls.map(([{ create }]) => [Number(create.eventId), create.roll])
    );
    expect(rollByEventId.get(30)).toEqual([3, 4]);
  });

  it("cube: value and owner come from each decision's own Match ID, every kind, owner seat -> userId (A2-shaped redouble)", async () => {
    serveSingleGame(
      gameReviewsResponse([
        // user_a is black (player 1), user_b white (player 0).
        moveEvent(10, { userId: "user_a", color: "black", matchId: mid() }), // centred 1-cube
        // user_b owns a 2-cube and redoubles; user_a takes.
        doubleEvent(20, "user_b", mid({ cubeValue: 2, cubeOwner: 0, diceOwner: 0, turn: 0 })),
        cubePassEvent(30, "user_a", true, mid({ cubeValue: 2, cubeOwner: 0, diceOwner: 0, turn: 1, doubleOffered: true })),
        moveEvent(40, { userId: "user_b", color: "white", matchId: mid({ cubeValue: 4, cubeOwner: 1, diceOwner: 0, turn: 0 }) }),
      ])
    );

    const summary = await ingestMatch(90000013, indexData, "token");

    expect(summary.warnings).toHaveLength(0);
    const byEventId = new Map(
      decisionUpsert.mock.calls.map(([{ create }]) => [
        Number(create.eventId),
        { value: create.cubeValue, owner: create.cubeOwnerUserId, confident: create.cubeConfident },
      ])
    );
    expect(byEventId.get(10)).toEqual({ value: 1, owner: null, confident: true });
    expect(byEventId.get(20)).toEqual({ value: 2, owner: "user_b", confident: true });
    expect(byEventId.get(30)).toEqual({ value: 2, owner: "user_b", confident: true });
    expect(byEventId.get(40)).toEqual({ value: 4, owner: "user_a", confident: true });
  });

  it("cube: cubeActionPlayed/cubeActionBest come from actionLabels(), gated to CUBE kind only", async () => {
    serveSingleGame(
      gameReviewsResponse([
        moveEvent(10, { userId: "user_a" }),
        doubleEvent(20, "user_a"), // double: true, doublers_best_action: "double"
        cubePassEvent(30, "user_b", true), // take: true, receivers_best_action: "take"
      ])
    );

    await ingestMatch(90000015, indexData, "token");

    const byEventId = new Map(
      decisionUpsert.mock.calls.map(([{ create }]) => [
        Number(create.eventId),
        { played: create.cubeActionPlayed, best: create.cubeActionBest },
      ])
    );
    // CHECKER kind: no cube action labels, column stays null.
    expect(byEventId.get(10)).toEqual({ played: null, best: null });
    expect(byEventId.get(20)).toEqual({ played: "doubled", best: "double" });
    expect(byEventId.get(30)).toEqual({ played: "took", best: "take" });
  });

  it("cube: a decision with no decodable Match ID stores no cube, cubeConfident false, and warns", async () => {
    serveSingleGame(
      gameReviewsResponse([
        moveEvent(10, { userId: "user_a", color: "black", matchId: mid() }),
        moveEvent(20, { userId: "user_b", color: "white", matchId: "not-a-match-id" }),
      ])
    );

    const summary = await ingestMatch(90000014, indexData, "token");

    const byEventId = new Map(
      decisionUpsert.mock.calls.map(([{ create }]) => [
        Number(create.eventId),
        { value: create.cubeValue, owner: create.cubeOwnerUserId, confident: create.cubeConfident },
      ])
    );
    expect(byEventId.get(10)).toEqual({ value: 1, owner: null, confident: true });
    expect(byEventId.get(20)).toEqual({ value: null, owner: null, confident: false });
    expect(summary.warnings).toHaveLength(1);
    expect(summary.warnings[0]).toMatch(/event 20: GNU Match ID missing or undecodable/);
  });

  it("analysis check: a counted move with a malformed candidate list warns and counts, and is still stored", async () => {
    const malformed = moveEvent(10, { userId: "user_a" });
    const moves = (malformed.reviews[0].result as unknown as { result: { moves: Record<string, unknown>[] } }).result
      .moves;
    moves[0].equity = "not a number";
    serveSingleGame(gameReviewsResponse([malformed, moveEvent(20, { userId: "user_a" })]));

    const summary = await ingestMatch(90000016, indexData, "token");

    expect(summary.analysisMissing).toBe(1);
    const analysisWarnings = summary.warnings.filter((w) => w.includes("no normalized analysis"));
    expect(analysisWarnings).toEqual([
      'match 90000016 game 1 event 10: no normalized analysis for counted "move" decision (raw unreadable by the translator), stored anyway',
    ]);
    expect(summary.errors).toEqual([]);
    // Both rows are still stored, with raw exactly as Galaxy sent it.
    expect(summary.decisionsIngested).toBe(2);
    const created = decisionUpsert.mock.calls.map(([{ create }]) => create);
    expect(created.map((c) => Number(c.eventId))).toEqual([10, 20]);
    expect((created[0].raw as typeof malformed).reviews[0].result).toEqual(malformed.reviews[0].result);
    // Nothing analysis-shaped is written to the row.
    for (const c of created) expect(c).not.toHaveProperty("analysis");
  });

  it("analysis check: no warning for readable counted CHECKER/CUBE rows, uncounted rows, rawError null, or a resignation", async () => {
    serveSingleGame(
      gameReviewsResponse([
        diceRolledEvent(5, [3, 4]), // count_as_decision: false
        moveEvent(10, { userId: "user_a" }),
        doubleEvent(20, "user_a"),
        cubePassEvent(30, "user_b", true),
      ])
    );
    const summary = await ingestMatch(90000017, indexData, "token");
    expect(summary.analysisMissing).toBe(0);
    expect(summary.warnings.filter((w) => w.includes("no normalized analysis"))).toEqual([]);

    serveSingleGame(lowConfidenceDoubtful as unknown as GameReviewsResponse);
    const lowConfidence = await ingestMatch(90000018, indexData, "token");
    expect(lowConfidence.analysisMissing).toBe(0);

    decisionUpsert.mockClear();
    serveSingleGame(resignation as unknown as GameReviewsResponse);
    const resigned = await ingestMatch(90000019, indexData, "token");
    expect(decisionUpsert.mock.calls[0][0].create.kind).toBe("RESIGNATION");
    expect(decisionUpsert.mock.calls[0][0].create.countAsDecision).toBe(true);
    expect(resigned.analysisMissing).toBe(0);
    expect(resigned.warnings.filter((w) => w.includes("no normalized analysis"))).toEqual([]);
  });

  it("assigns plyNumber 1-4 by eventId ascending regardless of array order, null beyond ply 4, and skips ineligible events", async () => {
    // Deliberately shuffled and with a gap: eventIds 50/10/90/20/30/40/70/60,
    // one of which (30) has a null error_analysis and must not consume a ply
    // slot. In eventId order, the eligible ones are 10,20,40,50,60,70,90 —
    // so ply 1-4 should land on 10,20,40,50, and 60/70/90 should be null.
    serveSingleGame(
      gameReviewsResponse([
        moveEvent(50),
        moveEvent(10),
        moveEvent(90),
        moveEvent(20),
        moveEvent(30, { errorAnalysisNull: true }),
        moveEvent(40),
        moveEvent(70),
        moveEvent(60),
      ])
    );

    const summary = await ingestMatch(90000007, indexData, "token");

    expect(summary.decisionsIngested).toBe(7);
    const plyByEventId = new Map(
      decisionUpsert.mock.calls.map(([{ create }]) => [Number(create.eventId), create.plyNumber])
    );
    expect(plyByEventId.get(10)).toBe(1);
    expect(plyByEventId.get(20)).toBe(2);
    expect(plyByEventId.get(40)).toBe(3);
    expect(plyByEventId.get(50)).toBe(4);
    expect(plyByEventId.get(60)).toBeNull();
    expect(plyByEventId.get(70)).toBeNull();
    expect(plyByEventId.get(90)).toBeNull();
    expect(plyByEventId.has(30)).toBe(false);
  });

  it("stores NO Decision row for game_started/game_over events", async () => {
    serveSingleGame(gameStartedGameOver as unknown as GameReviewsResponse);

    const summary = await ingestMatch(90000006, indexData, "token");

    expect(summary.decisionsIngested).toBe(0);
    expect(decisionUpsert).not.toHaveBeenCalled();
    expect(summary.eventsSkippedNoReview).toBe(2);
  });
});

// POST /api/galaxy/matches/[matchId]/sync passes its client-supplied
// indexData into ingestMatch. Before the allow-list, ingestMatch spread it
// straight into the Match upsert, so any extra key landed on the row.
describe("Match index fields (mass-assignment guard)", () => {
  const hostile = {
    ...indexData,
    id: 1,
    source: "evil",
    sourceMatchId: "123",
    ingestStatus: "DONE",
    ingestError: "x",
    matchLength: 99,
    playedAt: new Date(0),
    createdAt: new Date(0),
  };

  it("writes only the 8 index fields to Match, ignoring extra keys", async () => {
    serveSingleGame(forcedMoveNotCounted as unknown as GameReviewsResponse);

    await ingestMatch(90000010, hostile as unknown as MatchIndexData, "token");

    const { create, update } = matchUpsert.mock.calls[0][0];
    expect(update).toEqual(indexData);
    expect(create).toEqual({ source: "galaxy", sourceMatchId: "90000010", ...indexData });
  });

  it("still writes all 8 legitimate fields with their values", async () => {
    serveSingleGame(forcedMoveNotCounted as unknown as GameReviewsResponse);

    await ingestMatch(90000011, indexData, "token");

    const { update } = matchUpsert.mock.calls[0][0];
    expect(Object.keys(update).sort()).toEqual(
      [
        "opponentCountry",
        "opponentError",
        "opponentName",
        "opponentRating",
        "opponentScore",
        "userError",
        "userRating",
        "userScore",
      ]
    );
    expect(update).toEqual(indexData);
  });
});

describe("parseMatchIndexData", () => {
  it("accepts a well-formed payload and returns exactly the 8 fields", () => {
    expect(parseMatchIndexData({ ...indexData, ingestStatus: "DONE", id: 1 })).toEqual(indexData);
  });

  it("accepts an empty-string country (column is non-null, not non-empty)", () => {
    expect(parseMatchIndexData({ ...indexData, opponentCountry: "" })?.opponentCountry).toBe("");
  });

  it("rejects a missing field", () => {
    const missing: Record<string, unknown> = { ...indexData };
    delete missing.userScore;
    expect(parseMatchIndexData(missing)).toBeNull();
  });

  it("rejects wrong types", () => {
    expect(parseMatchIndexData({ ...indexData, opponentRating: "1500" })).toBeNull();
    expect(parseMatchIndexData({ ...indexData, opponentName: 7 })).toBeNull();
    expect(parseMatchIndexData({ ...indexData, userError: null })).toBeNull();
  });

  it("rejects non-objects", () => {
    for (const v of [undefined, null, "x", 3, [indexData]]) expect(parseMatchIndexData(v)).toBeNull();
  });

  it("doesn't count inherited properties as present", () => {
    const viaProto = Object.create({ ...indexData });
    expect(parseMatchIndexData(viaProto)).toBeNull();
  });
});
