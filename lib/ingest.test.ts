// Regression tests for lib/ingest.ts's event-processing decisions, pinned
// against fixture payloads (lib/__fixtures__/galaxy-payloads/) shaped like
// real Galaxy game_reviews responses — each fixture reconstructs one edge
// case already hit and fixed during this project's history (see
// PROGRESS.md / docs/field-mapping.md), so a future refactor that
// reintroduces one of these bugs fails a test immediately instead of
// silently shipping. Prisma and the Galaxy client are both mocked — no
// live DB or network call, pure processing-logic verification.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GameReviewsResponse } from "@/lib/gameReviewsTypes";
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
  matchUpsert: vi.fn(async () => ({ id: 1 })),
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

import { ingestMatch } from "@/lib/ingest";

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

  it("stores NO Decision row for game_started/game_over events", async () => {
    serveSingleGame(gameStartedGameOver as unknown as GameReviewsResponse);

    const summary = await ingestMatch(90000006, indexData, "token");

    expect(summary.decisionsIngested).toBe(0);
    expect(decisionUpsert).not.toHaveBeenCalled();
    expect(summary.eventsSkippedNoReview).toBe(2);
  });
});
