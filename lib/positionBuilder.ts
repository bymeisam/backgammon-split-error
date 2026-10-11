import type { CubeOwner, Side } from "@/lib/boardGeometry";
import type { DecodedPosition } from "@/lib/gnuPositionId";

export type BuilderAction = "add" | "remove";
export type BuilderLocation = number | "bar";

export const CUBE_VALUES = [1, 2, 4, 8, 16, 32, 64] as const;
export const MATCH_LENGTHS = [0, 1, 3, 5, 7, 9, 11, 13, 15] as const;

export interface PositionBuilderState {
  position: DecodedPosition;
  roll: [number, number] | null;
  playerToMove: Side;
  score: [number, number];
  matchLength: number;
  cubeValue: number;
  cubeOwner: CubeOwner;
}

export type EditResult =
  | { position: DecodedPosition; error: null }
  | { position: null; error: string };

function emptySide(): number[] {
  return new Array(24).fill(0);
}

export function emptyPosition(): DecodedPosition {
  return {
    mine: emptySide(),
    opponent: emptySide(),
    mineBar: 0,
    opponentBar: 0,
    mineOff: 15,
    opponentOff: 15,
  };
}

export function startingPosition(): DecodedPosition {
  const position = emptyPosition();
  position.mineOff = 0;
  position.opponentOff = 0;
  position.mine[23] = 2;
  position.mine[12] = 5;
  position.mine[7] = 3;
  position.mine[5] = 5;
  position.opponent[0] = 2;
  position.opponent[11] = 5;
  position.opponent[16] = 3;
  position.opponent[18] = 5;
  return position;
}

export function initialPositionBuilderState(): PositionBuilderState {
  return {
    position: startingPosition(),
    roll: null,
    playerToMove: "mine",
    score: [0, 0],
    matchLength: 7,
    cubeValue: 1,
    cubeOwner: "center",
  };
}

export function clonePosition(position: DecodedPosition): DecodedPosition {
  return {
    mine: [...position.mine],
    opponent: [...position.opponent],
    mineBar: position.mineBar,
    opponentBar: position.opponentBar,
    mineOff: position.mineOff,
    opponentOff: position.opponentOff,
  };
}

export function checkerTotal(position: DecodedPosition, side: Side): number {
  const points = position[side].reduce((total, count) => total + count, 0);
  return points + position[`${side}Bar`] + position[`${side}Off`];
}

function countAt(position: DecodedPosition, side: Side, location: BuilderLocation): number {
  if (location === "bar") return position[`${side}Bar`];
  return position[side][location - 1];
}

function setCount(position: DecodedPosition, side: Side, location: BuilderLocation, count: number): void {
  if (location === "bar") {
    position[`${side}Bar`] = count;
  } else {
    position[side][location - 1] = count;
  }
}

export function editChecker(
  position: DecodedPosition,
  side: Side,
  action: BuilderAction,
  location: BuilderLocation
): EditResult {
  if (typeof location === "number" && (location < 1 || location > 24 || !Number.isInteger(location))) {
    return { position: null, error: "Choose a board point from 1 through 24." };
  }

  const next = clonePosition(position);
  const current = countAt(next, side, location);
  const other: Side = side === "mine" ? "opponent" : "mine";

  if (action === "add") {
    if (next[`${side}Off`] <= 0) return { position: null, error: "That side has no unplaced checkers left." };
    if (typeof location === "number" && countAt(next, other, location) > 0) {
      return { position: null, error: "A legal point cannot contain both sides." };
    }
    next[`${side}Off`] -= 1;
    setCount(next, side, location, current + 1);
  } else {
    if (current <= 0) return { position: null, error: "There is no checker from that side in this location." };
    next[`${side}Off`] += 1;
    setCount(next, side, location, current - 1);
  }

  return { position: next, error: null };
}

export function validatePosition(position: DecodedPosition): string[] {
  const errors: string[] = [];
  const sides: Side[] = ["mine", "opponent"];

  for (const side of sides) {
    if (checkerTotal(position, side) !== 15) {
      errors.push(`${side === "mine" ? "Bottom" : "Top"} must have exactly 15 checkers.`);
    }
    if (position[`${side}Bar`] < 0 || position[`${side}Off`] < 0 || position[side].some((count) => count < 0)) {
      errors.push(`${side === "mine" ? "Bottom" : "Top"} has an invalid checker count.`);
    }
  }

  for (let point = 1; point <= 24; point++) {
    if (position.mine[point - 1] > 0 && position.opponent[point - 1] > 0) {
      errors.push(`Point ${point} cannot contain both sides.`);
    }
  }

  return errors;
}

export function validateBuilderState(state: PositionBuilderState): string[] {
  const errors = validatePosition(state.position);
  const [bottomScore, topScore] = state.score;

  if (!MATCH_LENGTHS.includes(state.matchLength as (typeof MATCH_LENGTHS)[number])) {
    errors.push("Match length must be a supported money-game or odd match length.");
  }
  if (bottomScore < 0 || topScore < 0 || !Number.isInteger(bottomScore) || !Number.isInteger(topScore)) {
    errors.push("Scores must be whole numbers that are zero or greater.");
  }
  if (state.matchLength > 0 && (bottomScore >= state.matchLength || topScore >= state.matchLength)) {
    errors.push("A match score must be below the match length.");
  }
  if (
    state.roll &&
    (state.roll.length !== 2 || state.roll.some((die) => !Number.isInteger(die) || die < 1 || die > 6))
  ) {
    errors.push("A roll must contain two dice from 1 through 6.");
  }
  if (!CUBE_VALUES.includes(state.cubeValue as (typeof CUBE_VALUES)[number])) {
    errors.push("Cube value must be a power of two from 1 through 64.");
  }
  if (state.cubeValue === 1 && state.cubeOwner !== "center") {
    errors.push("A cube at 1 must be centered.");
  }
  if (state.cubeValue > 1 && state.cubeOwner === "center") {
    errors.push("A cube above 1 must have an owner.");
  }

  return errors;
}
