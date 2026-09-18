// Types for the raw JSON returned by Galaxy's
// /match-analytics/api/v1/analyses/list/{page} endpoint.

export interface RatingTitle {
  progress: number;
  level: number;
  title: string;
  shortTitle: string;
}

export interface MatchAnalysis {
  matchId: number;
  opponentCountry: string;
  opponentError: number;
  opponentName: string;
  opponentRating: number;
  opponentRatingTitle: RatingTitle;
  opponentScore: number;
  userError: number;
  userRating: number;
  userScore: number;
}

export interface AnalysesListResponse {
  analyses: MatchAnalysis[];
  country: string;
  page: number;
  ratingTitle: RatingTitle;
  totalPages: number;
  userId: string;
  userName: string;
}
