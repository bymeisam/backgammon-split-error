// Backgammon Galaxy match-analytics API endpoints. Centralized here so the
// host/path shape only needs updating in one place.

const BASE_URL = "https://api.backgammongalaxy.com";

// https://api.backgammongalaxy.com/match-analytics/api/v1/game_reviews/46458748/1
export function gameReviewsUrl(matchId: string, gameIndex: number): string {
  return `${BASE_URL}/match-analytics/api/v1/game_reviews/${matchId}/${gameIndex}`;
}

// https://api.backgammongalaxy.com/stats/api/v2/analyses/list/1
export function analysesListUrl(page: number): string {
  return `${BASE_URL}/stats/api/v2/analyses/list/${page}`;
}
