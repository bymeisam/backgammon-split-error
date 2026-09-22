// Types for the raw JSON returned by Galaxy's
// /match-analytics/api/v1/game_reviews/{matchId}/{gameIndex} endpoint.

export type ErrorSeverity = "none" | "doubtful" | "error" | "blunder";

export type PlayerColor = "black" | "white" | "";

export type EventType =
  | "move_commited"
  | "dice_rolled"
  | "double_requested"
  | "double_accepted"
  | "double_rejected"
  | "resigned"
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
  // Confirmed nullable against a real payload: some events have a non-null
  // error_analysis (real error_severity/is_blunder/luck values) but a null
  // raw_error — analysis_level: 1, error_severity: "doubtful", event_type
  // "dice_rolled" paired with analysed_event "cube_double" — a partial/
  // low-confidence analysis that grades severity without a computed
  // equity-error magnitude (see docs/field-mapping.md).
  raw_error: number | null;
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

// Resignation events (event_type: "resigned") have no cube_analysis and no
// moves — a structurally distinct fourth shape, not a variant of the cube
// shape. Confirmed against a real payload (match 2856675, event 440889365):
// result.result keys were exactly metadata/equity/probabilities/
// error_analysis/resign_error/should_resign/resignation_type/equity_before/
// equity_after — no cube_analysis key at all. In that same real payload,
// resignation_type/equity_before/equity_after were all present but `null`
// (not just absent) — confirmed nullable rather than assumed non-null.
export interface ResignationResult extends AnalysisResultBase {
  resign_error: number;
  should_resign: boolean;
  resignation_type: string | null;
  equity_before: number | null;
  equity_after: number | null;
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

export interface ResignationAnalysisEnvelope {
  version: string;
  analysed_event: "resignation";
  result: ResignationResult;
}

export type AnalysisEnvelope =
  | MoveAnalysisEnvelope
  | CubeAnalysisEnvelope
  | ResignationAnalysisEnvelope;

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
