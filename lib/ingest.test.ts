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
  gameUpdate: vi.fn(async () => ({})),
  playerIdentityFindFirst: vi.fn(async () => null),
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

// Minimal but structurally complete CHECKER ("move") event — enough for
// ingestMatch to fully process it into a Decision row, used to build
// multi-event fixtures inline (for the plyNumber test below) rather than a
// full JSON fixture file, since only eventId/event_type/analysed_event/
// error_analysis actually vary across cases.
function moveEvent(id: number, opts: { errorAnalysisNull?: boolean } = {}): GameEvent {
  return {
    id,
    color: "white",
    user_id: "user_me",
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
        source_match: null,
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
              match_length: 7,
              scores: { black: 0, white: 0 },
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

  it("handles a money-game match (scores: null, match_length: null) without erroring, storing null score fields", async () => {
    serveSingleGame(moneyGameMove as unknown as GameReviewsResponse);

    const summary = await ingestMatch(90000004, indexData, "token");

    expect(summary.errors).toHaveLength(0);
    expect(summary.decisionsIngested).toBe(1);
    const create = decisionUpsert.mock.calls[0][0].create;
    expect(create.matchScoreBlack).toBeNull();
    expect(create.matchScoreWhite).toBeNull();

    // matchLength stays null throughout a money game — the match-level
    // update should never set it (playedAt still gets set independently).
    expect(matchUpdate).toHaveBeenCalledTimes(1);
    const matchUpdateData = matchUpdate.mock.calls[0][0].data;
    expect(matchUpdateData).not.toHaveProperty("matchLength");
    expect(matchUpdateData).toHaveProperty("playedAt");
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
