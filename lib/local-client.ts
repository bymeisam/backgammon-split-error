// DB-backed read path for match data — same shapes the Galaxy-calling code
// uses (AnalysesListResponse / GameReviewsResponse), sourced from MySQL
// instead of the Galaxy API. Read-only; nothing here writes to the DB — uses
// the read-only client (DATABASE_URL_READONLY / bg_readonly in production)
// accordingly.
import { prismaReadOnly as prisma } from "@/lib/prisma";
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

interface MatchRow {
  sourceMatchId: string;
  opponentCountry: string;
  opponentError: number;
  opponentName: string;
  opponentRating: number;
  opponentScore: number;
  userError: number;
  userRating: number;
  userScore: number;
  playedAt: Date | null;
  createdAt: Date;
}

export async function listMatches(page: number): Promise<AnalysesListResponse> {
  const [rows, total] = await Promise.all([
    // Sorted by sourceMatchId (Galaxy's own matchId) descending, not
    // playedAt — playedAt is unreliable for most of this app's historical
    // data (see docs/field-mapping.md's "playedAt: what it actually means"
    // section: it reflects ingest-processing time for anything from the
    // original 2026-09 backfill, not real play dates), while matchId is
    // always populated and correlates with recency — the same proxy
    // app/galaxy/matches/page.tsx already sorts by, for consistency.
    // sourceMatchId is a VARCHAR (values range from 5 to 8+ digits), so a
    // plain `ORDER BY sourceMatchId` would sort lexicographically, not
    // numerically — raw SQL with an explicit CAST is required here, Prisma's
    // `orderBy` has no way to express that.
    prisma.$queryRaw<MatchRow[]>`
      SELECT sourceMatchId, opponentCountry, opponentError, opponentName,
             opponentRating, opponentScore, userError, userRating, userScore,
             playedAt, createdAt
      FROM \`Match\`
      ORDER BY CAST(sourceMatchId AS UNSIGNED) DESC
      LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}
    `,
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
    playedAt: (m.playedAt ?? m.createdAt).toISOString(),
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
