import { describe, expect, it } from "vitest";
import type { GameEvent } from "@/lib/gameReviewsTypes";
import { computeCubeStates, flipCubeState, type CubeState } from "@/lib/cubeState";

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

const METADATA = {
  timestamp: "2026-09-18T02:49:15.400013Z",
  analysis_level: 2,
  analysis_time_ms: 5,
  crawford_state: "none",
  match_length: 7,
  scores: { black: 0, white: 0 },
  count_as_decision: true,
  request_id: null,
  max_move: null,
};

const CUBE_ANALYSIS = {
  optimal: 0,
  cubeless: 0,
  doublers_best_action: "double",
  receivers_best_action: "take",
  cube_decision_meaningful: true,
  cube_level: 1,
  diff_double_pass: 0,
  diff_double_take: 0,
  diff_no_double: 0,
  double_pass: 0,
  double_take: 0,
  no_double: 0,
  receiver_diff_double_pass: 0,
  receiver_diff_double_take: 0,
  too_good_meaningful: false,
};

// Minimal but structurally complete CHECKER ("move") event — only
// id/user_id actually matter for computeCubeStates's own walk.
function moveEvent(id: number, userId: string): GameEvent {
  return {
    id,
    color: "white",
    user_id: userId,
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
            metadata: METADATA,
            probabilities: PROBABILITIES,
            error_analysis: ERROR_ANALYSIS_NONE,
            moves: [],
          },
        },
      },
    ],
  } as unknown as GameEvent;
}

// A cube_double decision row. `doubled: false` reproduces the routine
// "should I double" check Galaxy runs before most rolls (often
// countAsDecision: false) — real field values confirmed against match
// 7901's actual data (see PROGRESS.md).
function cubeDoubleEvent(id: number, userId: string, doubled: boolean): GameEvent {
  return {
    id,
    color: "white",
    user_id: userId,
    moves: [],
    event_type: doubled ? "double_requested" : "dice_rolled",
    rolled_dice: [],
    reviews: [
      {
        id: id + 1_000_000,
        second: 1,
        take: null,
        level: 2,
        double: doubled,
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
            metadata: METADATA,
            probabilities: PROBABILITIES,
            error_analysis: ERROR_ANALYSIS_NONE,
            cube_analysis: CUBE_ANALYSIS,
          },
        },
      },
    ],
  } as unknown as GameEvent;
}

// A cube_pass decision row (the receiver's take/pass response).
function cubePassEvent(id: number, userId: string, taken: boolean): GameEvent {
  return {
    id,
    color: "white",
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
        source_match: null,
        resigned_points: null,
        source_position: { id: 1, classification: "opening_game", formatted_value: "pos" },
        destination_position: null,
        result: {
          version: "1.0",
          analysed_event: "cube_pass",
          result: {
            equity: 0,
            metadata: METADATA,
            probabilities: PROBABILITIES,
            error_analysis: ERROR_ANALYSIS_NONE,
            cube_analysis: CUBE_ANALYSIS,
          },
        },
      },
    ],
  } as unknown as GameEvent;
}

const A = "649fbd28"; // real match-7901 doubler/final-passer user id (trimmed)
const B = "62febc99"; // real match-7901 taker/redoubler user id (trimmed)

describe("computeCubeStates", () => {
  it("stays centered all game when no cube action ever happens", () => {
    const events = [moveEvent(1, A), moveEvent(2, B), moveEvent(3, A)];
    const states = computeCubeStates(events);
    for (const event of events) {
      expect(states.get(event.id)).toEqual({ value: 1, owner: "center", confident: true });
    }
  });

  it("reproduces the real match-7901 double -> take -> redouble -> pass sequence", () => {
    const events = [
      moveEvent(1, A), // before anything — still centered
      cubeDoubleEvent(2, A, true), // A doubles
      cubePassEvent(3, B, true), // B takes — cube now at B's side (the taker), value 2
      moveEvent(4, B), // B's own first decision after taking
      cubeDoubleEvent(5, B, true), // B redoubles
      cubePassEvent(6, A, false), // A passes — game ends
    ];
    const states = computeCubeStates(events);

    // Entering event 1: no cube action yet.
    expect(states.get(1)).toEqual({ value: 1, owner: "center", confident: true });
    // Entering event 2 (A's own double decision): still centered.
    expect(states.get(2)).toEqual({ value: 1, owner: "center", confident: true });
    // Entering event 3 (B's take/pass decision): still centered — the
    // double isn't applied until accepted.
    expect(states.get(3)).toEqual({ value: 1, owner: "center", confident: true });
    // Entering event 4 (B's own next decision): accepted — cube at value 2,
    // owned by B, relative to B's own perspective that's "mine".
    expect(states.get(4)).toEqual({ value: 2, owner: "mine", confident: true });
    // Entering event 5 (B's redouble decision): still value 2, "mine" (B's
    // own perspective again).
    expect(states.get(5)).toEqual({ value: 2, owner: "mine", confident: true });
    // Entering event 6 (A's pass decision): still value 2, but relative to
    // A's own perspective B's ownership reads as "opponent".
    expect(states.get(6)).toEqual({ value: 2, owner: "opponent", confident: true });
  });

  it("flags unconfident when a checker decision occurs while a double is still pending (dropped cube_pass)", () => {
    const events = [
      cubeDoubleEvent(1, A, true), // A doubles
      moveEvent(2, B), // the resolving cube_pass is missing — play continues anyway
      moveEvent(3, A),
    ];
    const states = computeCubeStates(events);
    expect(states.get(1)?.confident).toBe(true);
    expect(states.get(2)?.confident).toBe(false);
    expect(states.get(3)?.confident).toBe(false);
  });

  it("flags unconfident when a second double occurs before the first is resolved", () => {
    const events = [cubeDoubleEvent(1, A, true), cubeDoubleEvent(2, B, true)];
    const states = computeCubeStates(events);
    expect(states.get(1)?.confident).toBe(true);
    expect(states.get(2)?.confident).toBe(false);
  });

  it("flags unconfident when a cube_pass occurs with no pending double", () => {
    const events = [moveEvent(1, A), cubePassEvent(2, B, true)];
    const states = computeCubeStates(events);
    expect(states.get(1)?.confident).toBe(true);
    expect(states.get(2)?.confident).toBe(false);
  });

  it("does not flag a double left unresolved at the very end of the array", () => {
    const events = [moveEvent(1, A), cubeDoubleEvent(2, A, true)];
    const states = computeCubeStates(events);
    expect(states.get(1)?.confident).toBe(true);
    expect(states.get(2)?.confident).toBe(true);
  });

  it("ignores a 'did not double' routine check (double: false) — no state change, no violation", () => {
    const events = [cubeDoubleEvent(1, A, false), moveEvent(2, A)];
    const states = computeCubeStates(events);
    expect(states.get(1)).toEqual({ value: 1, owner: "center", confident: true });
    expect(states.get(2)).toEqual({ value: 1, owner: "center", confident: true });
  });
});

describe("flipCubeState", () => {
  it("swaps mine and opponent", () => {
    const mine: CubeState = { value: 2, owner: "mine", confident: true };
    const opponent: CubeState = { value: 2, owner: "opponent", confident: true };
    expect(flipCubeState(mine)).toEqual({ value: 2, owner: "opponent", confident: true });
    expect(flipCubeState(opponent)).toEqual({ value: 2, owner: "mine", confident: true });
  });

  it("leaves center untouched", () => {
    const center: CubeState = { value: 1, owner: "center", confident: true };
    expect(flipCubeState(center)).toEqual(center);
  });

  it("is its own inverse", () => {
    const state: CubeState = { value: 4, owner: "mine", confident: false };
    expect(flipCubeState(flipCubeState(state))).toEqual(state);
  });

  it("preserves confident and value", () => {
    const state: CubeState = { value: 8, owner: "mine", confident: false };
    expect(flipCubeState(state)).toEqual({ value: 8, owner: "opponent", confident: false });
  });
});
