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
import { decodeGnuMatchId, encodeGnuMatchId, type DecodedMatchId } from "@/lib/gnuMatchId";

import forcedMoveNotCounted from "./__fixtures__/galaxy-payloads/forced-move-not-counted.json";
import doubleRejectedNullAnalysis from "./__fixtures__/galaxy-payloads/double-rejected-null-analysis.json";
import lowConfidenceDoubtful from "./__fixtures__/galaxy-payloads/low-confidence-doubtful.json";
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
    // metadata.timestamp (Galaxy's serve time).
    timestamp?: string;
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
              timestamp: opts.timestamp ?? "2026-09-18T02:49:15.400013Z",
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

  it("writes only the kept Decision columns — every derivable value stays in raw (2026-10-07)", async () => {
    playerIdentityFindFirst.mockResolvedValueOnce({ sourceUserId: "user_me" });
    serveSingleGame(
      gameReviewsResponse([
        diceRolledEvent(5, [3, 4]),
        moveEvent(10, { userId: "user_me", color: "black", matchId: mid() }),
        doubleEvent(20, "user_opp", mid({ diceOwner: 0, turn: 0 })),
        cubePassEvent(30, "user_me", true, mid({ diceOwner: 0, turn: 1, doubleOffered: true })),
      ])
    );

    const summary = await ingestMatch(90000004, indexData, "token");

    expect(summary.errors).toEqual([]);
    expect(summary.decisionsIngested).toBe(4);
    const KEPT = [
      "classification",
      "countAsDecision",
      "errorSeverity",
      "eventId",
      "gameId",
      "kind",
      "plyNumber",
      "raw",
      "rawError",
      "sourcePositionId",
      "userId",
    ];
    for (const [{ create, update }] of decisionUpsert.mock.calls as unknown as [
      { create: Record<string, unknown>; update: Record<string, unknown> },
    ][]) {
      expect(Object.keys(create).sort()).toEqual(KEPT);
      expect(Object.keys(update).sort()).toEqual(KEPT.filter((k) => k !== "eventId" && k !== "gameId"));
    }
    // raw is the event exactly as Galaxy sent it.
    const move = decisionUpsert.mock.calls.find(([{ create }]) => Number(create.eventId) === 10)![0].create;
    expect(move.raw).toEqual(moveEvent(10, { userId: "user_me", color: "black", matchId: mid() }));
  });

  it("writes nothing to Game beyond its key: no scores, Crawford or playedAt", async () => {
    playerIdentityFindFirst.mockResolvedValueOnce({ sourceUserId: "user_me" });
    serveSingleGame(
      gameReviewsResponse([moveEvent(10, { userId: "user_me", color: "black", matchId: mid({ score: [3, 6] }) })])
    );

    await ingestMatch(90000011, indexData, "token");

    expect(gameUpdate).not.toHaveBeenCalled();
    expect(gameUpsert).toHaveBeenCalledWith({
      where: { matchId_gameIndex: { matchId: 1, gameIndex: 1 } },
      create: { matchId: 1, gameIndex: 1 },
      update: {},
    });
  });

  it("Match.playedAt: the first game's first decision by eventId (not the earliest timestamp); no matchLength", async () => {
    const games: Record<number, GameReviewsResponse> = {
      1: gameReviewsResponse([
        moveEvent(20, { timestamp: "2026-09-18T02:00:00.000Z" }),
        moveEvent(10, { timestamp: "2026-09-18T03:00:00.000Z" }),
      ]),
      2: gameReviewsResponse([moveEvent(30, { timestamp: "2026-09-18T01:00:00.000Z" })]),
    };
    getGameReviews.mockImplementation(async (_matchId: number, gameIndex: number) => games[gameIndex] ?? null);

    await ingestMatch(90000012, indexData, "token");

    expect(matchUpdate).toHaveBeenCalledTimes(1);
    expect(matchUpdate.mock.calls[0][0].data).toEqual({ playedAt: new Date("2026-09-18T03:00:00.000Z") });
  });

  it("Match.playedAt: a first game with no stored decision is skipped; no update when no game has one", async () => {
    const games: Record<number, GameReviewsResponse> = {
      1: gameReviewsResponse([moveEvent(10, { errorAnalysisNull: true })]),
      2: gameReviewsResponse([moveEvent(30, { timestamp: "2026-09-18T01:00:00.000Z" })]),
    };
    getGameReviews.mockImplementation(async (_matchId: number, gameIndex: number) => games[gameIndex] ?? null);
    await ingestMatch(90000013, indexData, "token");
    expect(matchUpdate.mock.calls[0][0].data).toEqual({ playedAt: new Date("2026-09-18T01:00:00.000Z") });

    matchUpdate.mockClear();
    serveSingleGame(gameReviewsResponse([moveEvent(10, { errorAnalysisNull: true })]));
    await ingestMatch(90000014, indexData, "token");
    expect(matchUpdate).not.toHaveBeenCalled();
  });

  it("a decision with no decodable Match ID (no roll or cube will show) warns, and is still stored", async () => {
    serveSingleGame(
      gameReviewsResponse([
        moveEvent(10, { userId: "user_a", color: "black", matchId: mid() }),
        moveEvent(20, { userId: "user_b", color: "white", matchId: "not-a-match-id" }),
        moveEvent(30, { userId: "user_a", color: "black", matchId: null }),
      ])
    );

    const summary = await ingestMatch(90000015, indexData, "token");

    expect(summary.decisionsIngested).toBe(3);
    expect(summary.warnings).toHaveLength(2);
    expect(summary.warnings[0]).toMatch(/event 20: GNU Match ID missing or undecodable/);
    expect(summary.warnings[1]).toMatch(/event 30: GNU Match ID missing or undecodable/);
  });

  it("stores a RESIGNATION decision (its resignation detail stays in raw)", async () => {
    serveSingleGame(resignation as unknown as GameReviewsResponse);

    const summary = await ingestMatch(90000005, indexData, "token");

    expect(summary.decisionsIngested).toBe(1);
    const create = decisionUpsert.mock.calls[0][0].create;
    expect(create.kind).toBe("RESIGNATION");
    expect(create).not.toHaveProperty("resignError");
    const result = (create.raw as { reviews: { result: { result: Record<string, unknown> } }[] }).reviews[0].result.result;
    expect(result.resign_error).toBe(0.15);
    expect(result.should_resign).toBe(true);
  });

  it("populates sourcePositionId from source_position.formatted_value", async () => {
    serveSingleGame(gameReviewsResponse([moveEvent(1)]));

    const summary = await ingestMatch(90000008, indexData, "token");

    expect(summary.decisionsIngested).toBe(1);
    const create = decisionUpsert.mock.calls[0][0].create;
    expect(create.sourcePositionId).toBe("pos");
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
