import type { AnalysesListResponse } from "@/lib/analysesTypes";
import type { GameReviewsResponse } from "@/lib/gameReviewsTypes";

// Shared read interface implemented by both lib/local-client.ts (DB-backed)
// and lib/galaxy-client.ts (Galaxy-API-backed), so callers (routes, pages)
// don't need to care which source they're talking to.
export interface MatchDataClient {
  listMatches(page: number): Promise<AnalysesListResponse>;
  getGameReviews(matchId: number, gameIndex: number): Promise<GameReviewsResponse | null>;
}
