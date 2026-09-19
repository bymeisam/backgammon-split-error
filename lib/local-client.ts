// DB-backed read path for match data — same shapes the Galaxy-calling code
// uses (AnalysesListResponse / GameReviewsResponse), sourced from MySQL
// instead of the Galaxy API. Read-only; nothing here writes to the DB.
import { prisma } from "@/lib/prisma";
import type { AnalysesListResponse, MatchAnalysis, RatingTitle } from "@/lib/analysesTypes";
import type { GameEvent, GameReviewsResponse } from "@/lib/gameReviewsTypes";
import type { MatchDataClient } from "@/lib/types/data-client";

const PAGE_SIZE = 30;

// Local-client reads rows that were ingested from Galaxy, so the source tag
// used to resolve Match by (source, sourceMatchId) is hardcoded here too.
const SOURCE = "galaxy";

// We don't store rating-title/"who's asking" data locally (nothing here
// models a logged-in Galaxy user) — these fields exist only to satisfy the
// shared response shape and aren't rendered by the current list UI.
const PLACEHOLDER_RATING_TITLE: RatingTitle = {
  progress: 0,
  level: 0,
  title: "",
  shortTitle: "",
};

export async function listMatches(page: number): Promise<AnalysesListResponse> {
  const [rows, total] = await Promise.all([
    prisma.match.findMany({
      orderBy: { id: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.match.count(),
  ]);

  const analyses: MatchAnalysis[] = rows.map((m) => ({
    matchId: Number(m.sourceMatchId),
    opponentCountry: m.opponentCountry,
    opponentError: m.opponentError,
    opponentName: m.opponentName,
    opponentRating: m.opponentRating,
    opponentRatingTitle: PLACEHOLDER_RATING_TITLE,
    opponentScore: m.opponentScore,
    userError: m.userError,
    userRating: m.userRating,
    userScore: m.userScore,
  }));

  return {
    analyses,
    country: "",
    page,
    ratingTitle: PLACEHOLDER_RATING_TITLE,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    userId: "",
    userName: "",
  };
}

export async function getGameReviews(
  matchId: number,
  gameIndex: number
): Promise<GameReviewsResponse | null> {
  const match = await prisma.match.findUnique({
    where: { source_sourceMatchId: { source: SOURCE, sourceMatchId: String(matchId) } },
  });
  if (!match) return null;

  const game = await prisma.game.findUnique({
    where: { matchId_gameIndex: { matchId: match.id, gameIndex } },
  });
  if (!game) return null;

  const decisions = await prisma.decision.findMany({
    where: { gameId: game.id },
    orderBy: [{ timestamp: "asc" }, { id: "asc" }],
  });

  const events = decisions.map((d) => d.raw as unknown as GameEvent);

  return {
    data: { events, match_id: matchId, game_index: gameIndex },
    type: "game_events",
  };
}

// Explicit conformance to the shared interface (see lib/types/data-client.ts).
export const localClient: MatchDataClient = { listMatches, getGameReviews };
