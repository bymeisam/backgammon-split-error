// Types for the raw JSON returned by Galaxy's
// /match-analytics/api/v1/game_reviews/{matchId}/{gameIndex} endpoint.

export type ErrorSeverity = "none" | "doubtful" | "error" | "blunder";

export type PlayerColor = "black" | "white" | "";

export type EventType =
  | "move_commited"
  | "dice_rolled"
  | "double_requested"
  | "double_accepted"
  | "game_started"
  | "game_over"
  | "turn_forfeited";

export interface Metadata {
  timestamp: string;
  analysis_level: number;
  analysis_time_ms: number;
  crawford_state: string;
  match_length: number;
  // Null for money-game-type matches — confirmed against real data, not
  // assumed. crawford_state stays a plain string (always populated, e.g.
  // "none", even for money games — separately confirmed, not speculative).
  scores: {
    black: number;
    white: number;
  } | null;
  count_as_decision: boolean;
  request_id: string | null;
  max_move: number | null;
}

export interface Probabilities {
  lose: number;
  lose_backgammon: number;
  lose_gammon: number;
  win: number;
  win_backgammon: number;
  win_gammon: number;
  mwc_context: "cubeless" | "cubeful" | null;
  mwc: number | null;
  volatility: number | null;
  market_losing_probability: number | null;
  market_gaining_probability: number | null;
}

export interface ErrorAnalysis {
  raw_error: number;
  luck_mwc: number | null;
  mwc_error: number | null;
  luck: number | null;
  equity_error: number | null;
  error_severity: ErrorSeverity;
  is_blunder: boolean;
  is_error: boolean;
}

export interface CandidateMove {
  level: number;
  final: {
    xgid: string;
    gnubgid: string;
  };
  notation: string;
  rank: number;
  equity: number;
  probabilities: Probabilities;
  error_analysis: ErrorAnalysis;
  move_played: boolean;
}

export interface CubeAnalysis {
  optimal: number;
  cubeless: number;
  doublers_best_action: string;
  receivers_best_action: string;
  cube_decision_meaningful: boolean;
  cube_level: number;
  diff_double_pass: number;
  diff_double_take: number;
  diff_no_double: number;
  double_pass: number;
  double_take: number;
  no_double: number;
  receiver_diff_double_pass: number;
  receiver_diff_double_take: number;
  too_good_meaningful: boolean;
}

export interface PositionRef {
  id: number;
  classification: string;
  formatted_value: string;
}

export interface MatchRef {
  id: number;
  formatted_value: string;
}

interface AnalysisResultBase {
  metadata: Metadata;
  equity: number;
  probabilities: Probabilities;
  error_analysis: ErrorAnalysis;
}

export interface MoveResult extends AnalysisResultBase {
  moves: CandidateMove[];
}

export interface CubeResult extends AnalysisResultBase {
  cube_analysis: CubeAnalysis;
}

export interface MoveAnalysisEnvelope {
  version: string;
  analysed_event: "move";
  result: MoveResult;
}

export interface CubeAnalysisEnvelope {
  version: string;
  analysed_event: "cube_double" | "cube_pass";
  result: CubeResult;
}

export type AnalysisEnvelope = MoveAnalysisEnvelope | CubeAnalysisEnvelope;

export interface Review {
  id: number;
  second: number;
  take: boolean | null;
  level: number;
  result: AnalysisEnvelope;
  double: boolean | null;
  threshold: number | null;
  destination_position: PositionRef | null;
  source_position: PositionRef | null;
  source_match: MatchRef | null;
  resigned_points: number | null;
}

export interface GameEvent {
  id: number;
  color: PlayerColor;
  user_id: string;
  moves: number[];
  event_type: EventType;
  reviews: Review[];
  rolled_dice: number[];
}

export interface GameReviewsResponse {
  data: {
    events: GameEvent[];
    match_id: number;
    game_index: number;
  };
  type: "game_events";
}
