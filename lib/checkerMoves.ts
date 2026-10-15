import type { DecodedPosition } from "@/lib/gnuPositionId";

export type CheckerLocation = number | "bar";
export type CheckerDestination = number | "off";

export interface CheckerHop {
  from: CheckerLocation;
  to: CheckerDestination;
  die: number;
  hit: boolean;
}

export interface CheckerSequence {
  hops: CheckerHop[];
  position: DecodedPosition;
  notation: string;
}

export interface CheckerExplorerState {
  initialPosition: DecodedPosition;
  position: DecodedPosition;
  dice: number[];
  remainingDice: number[];
  usedDice: number[];
  hops: CheckerHop[];
  history: ExplorerSnapshot[];
}

interface ExplorerSnapshot {
  position: DecodedPosition;
  remainingDice: number[];
  usedDice: number[];
  hops: CheckerHop[];
}

export function cloneCheckerPosition(position: DecodedPosition): DecodedPosition {
  return {
    mine: [...position.mine],
    opponent: [...position.opponent],
    mineBar: position.mineBar,
    opponentBar: position.opponentBar,
    mineOff: position.mineOff,
    opponentOff: position.opponentOff,
  };
}

function validDie(die: number): boolean {
  return Number.isInteger(die) && die >= 1 && die <= 6;
}

function destinationFor(from: CheckerLocation, die: number): CheckerDestination {
  return from === "bar" ? 25 - die : from - die > 0 ? from - die : "off";
}

/** Bearing off needs every checker home: none on the bar, none above point 6. */
function allCheckersHome(position: DecodedPosition): boolean {
  return position.mineBar === 0 && position.mine.slice(6).every((count) => count === 0);
}

function canBearOff(position: DecodedPosition, from: number, die: number): boolean {
  if (!allCheckersHome(position)) return false;
  if (from === die) return true;
  // An oversized die may bear off only when no checker is farther from home.
  return from < die && position.mine.slice(from).every((count) => count === 0);
}

function hopKey(hop: CheckerHop): string {
  return `${hop.from}:${hop.to}:${hop.die}:${hop.hit ? 1 : 0}`;
}

function positionAfterHop(position: DecodedPosition, hop: CheckerHop): DecodedPosition {
  const next = cloneCheckerPosition(position);
  if (hop.from === "bar") next.mineBar -= 1;
  else next.mine[hop.from - 1] -= 1;

  if (hop.to === "off") {
    next.mineOff += 1;
  } else {
    if (next.opponent[hop.to - 1] === 1) {
      next.opponent[hop.to - 1] = 0;
      next.opponentBar += 1;
    }
    next.mine[hop.to - 1] += 1;
  }
  return next;
}

/** Every legal one-hop move for one die, before maximum-dice filtering. */
export function legalHopsForDie(position: DecodedPosition, die: number): CheckerHop[] {
  if (!validDie(die)) return [];
  const sources: CheckerLocation[] = position.mineBar > 0
    ? ["bar"]
    : position.mine.flatMap((count, index) => (count > 0 ? [index + 1] : []));
  const hops: CheckerHop[] = [];

  for (const from of sources) {
    const to = destinationFor(from, die);
    if (to === "off") {
      if (from !== "bar" && canBearOff(position, from, die)) hops.push({ from, to, die, hit: false });
      continue;
    }
    if (position.opponent[to - 1] >= 2) continue;
    hops.push({ from, to, die, hit: position.opponent[to - 1] === 1 });
  }
  return hops;
}

function notationLocation(location: CheckerLocation): string {
  return location === "bar" ? "bar" : String(location);
}

function notationHop(hop: CheckerHop): string {
  return `${notationLocation(hop.from)}/${hop.to === "off" ? "off" : hop.to}${hop.hit ? "*" : ""}`;
}

function sequenceNotation(hops: CheckerHop[]): string {
  return hops.map(notationHop).join(" ");
}

/**
 * Generate all maximal legal sequences. A sequence is maximal by number of
 * dice, and the larger die is retained when exactly one of two non-doubles
 * can be played, as required by backgammon's one-die rule.
 */
export function legalSequences(position: DecodedPosition, dice: readonly number[]): CheckerSequence[] {
  const usableDice = dice.filter(validDie);
  if (usableDice.length === 0) return [];

  const search = (current: DecodedPosition, remaining: number[], prefix: CheckerHop[]): CheckerSequence[] => {
    if (remaining.length === 0) {
      return [{ hops: prefix, position: cloneCheckerPosition(current), notation: sequenceNotation(prefix) }];
    }
    const branches: CheckerSequence[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < remaining.length; i += 1) {
      const die = remaining[i];
      for (const hop of legalHopsForDie(current, die)) {
        const branchKey = `${i}:${hopKey(hop)}`;
        if (seen.has(branchKey)) continue;
        seen.add(branchKey);
        const nextRemaining = remaining.slice(0, i).concat(remaining.slice(i + 1));
        branches.push(...search(positionAfterHop(current, hop), nextRemaining, [...prefix, hop]));
      }
    }
    if (branches.length === 0) {
      return [{ hops: prefix, position: cloneCheckerPosition(current), notation: sequenceNotation(prefix) }];
    }
    return branches;
  };

  const candidates = search(cloneCheckerPosition(position), usableDice, []);
  const maxLength = Math.max(...candidates.map((sequence) => sequence.hops.length));
  let maximal = candidates.filter((sequence) => sequence.hops.length === maxLength);

  // If only one die can be used from a two-die non-double roll, the larger
  // die is mandatory when it has any legal move.
  if (usableDice.length === 2 && usableDice[0] !== usableDice[1] && maxLength === 1) {
    const larger = Math.max(usableDice[0], usableDice[1]);
    const largerSequences = maximal.filter((sequence) => sequence.hops[0]?.die === larger);
    if (largerSequences.length > 0) maximal = largerSequences;
  }

  const distinct = new Map<string, CheckerSequence>();
  for (const sequence of maximal) {
    distinct.set(sequence.hops.map(hopKey).join("|"), sequence);
  }
  return [...distinct.values()];
}

/** Legal starts at the current step, already filtered to maximal sequences. */
export function legalHops(position: DecodedPosition, dice: readonly number[]): CheckerHop[] {
  const seen = new Set<string>();
  const hops: CheckerHop[] = [];
  for (const sequence of legalSequences(position, dice)) {
    const first = sequence.hops[0];
    if (!first || seen.has(hopKey(first))) continue;
    seen.add(hopKey(first));
    hops.push(first);
  }
  return hops;
}

export function createCheckerExplorer(position: DecodedPosition, dice: readonly number[]): CheckerExplorerState {
  const initialPosition = cloneCheckerPosition(position);
  const normalizedDice = dice.filter(validDie);
  const explorerDice = normalizedDice.length === 2 && normalizedDice[0] === normalizedDice[1]
    ? [...normalizedDice, ...normalizedDice]
    : normalizedDice;
  return {
    initialPosition,
    position: cloneCheckerPosition(initialPosition),
    dice: [...explorerDice],
    remainingDice: [...explorerDice],
    usedDice: [],
    hops: [],
    history: [],
  };
}

function snapshot(state: CheckerExplorerState): ExplorerSnapshot {
  return {
    position: cloneCheckerPosition(state.position),
    remainingDice: [...state.remainingDice],
    usedDice: [...state.usedDice],
    hops: state.hops.map((hop) => ({ ...hop })),
  };
}

/** Apply one currently permitted hop without mutating any prior state. */
export function playCheckerHop(state: CheckerExplorerState, hop: CheckerHop): CheckerExplorerState {
  const permitted = legalHops(state.position, state.remainingDice).find((candidate) => hopKey(candidate) === hopKey(hop));
  if (!permitted) throw new Error("That checker hop is not legal for the current dice.");
  const dieIndex = state.remainingDice.indexOf(permitted.die);
  const remainingDice = state.remainingDice.slice(0, dieIndex).concat(state.remainingDice.slice(dieIndex + 1));
  return {
    ...state,
    position: positionAfterHop(state.position, permitted),
    remainingDice,
    usedDice: [...state.usedDice, permitted.die],
    hops: [...state.hops, { ...permitted }],
    history: [...state.history, snapshot(state)],
  };
}

export function undoCheckerHop(state: CheckerExplorerState): CheckerExplorerState {
  const previous = state.history[state.history.length - 1];
  if (!previous) return state;
  return {
    ...state,
    position: cloneCheckerPosition(previous.position),
    remainingDice: [...previous.remainingDice],
    usedDice: [...previous.usedDice],
    hops: previous.hops.map((hop) => ({ ...hop })),
    history: state.history.slice(0, -1),
  };
}

export function resetCheckerExplorer(state: CheckerExplorerState): CheckerExplorerState {
  return createCheckerExplorer(state.initialPosition, state.dice);
}

export function isCheckerExplorerComplete(state: CheckerExplorerState): boolean {
  return state.remainingDice.length === 0 || legalHops(state.position, state.remainingDice).length === 0;
}

export function checkerMoveStatus(state: CheckerExplorerState): "ready" | "complete" | "no-legal-move" {
  if (state.hops.length === 0 && legalHops(state.position, state.remainingDice).length === 0) return "no-legal-move";
  return isCheckerExplorerComplete(state) ? "complete" : "ready";
}
