import type { GameEvent, GameReviewsResponse, Review } from "@/lib/gameReviewsTypes";

export const BLUNDER_THRESHOLD = 0.08;

export interface FetchedGame {
  gameIndex: number;
  data: GameReviewsResponse;
}

export type DecisionKind = "checker" | "cube" | "resignation";
export type Severity = "error" | "blunder";

export interface Decision {
  id: string;
  gameIndex: number;
  userId: string;
  color: string;
  kind: DecisionKind;
  absError: number;
  isMistake: boolean;
  severity: Severity | null;
  detail: string;
  myLabel: string;
  bestLabel: string;
  roll: number[];
  sourcePositionId: string | null;
  myMoveNotation: string | null;
  bestMoveNotation: string | null;
}

export interface PlayerOption {
  userId: string;
}

function formatCubeAction(action: string): string {
  return action.replace(/_/g, " ");
}

// The kind mapping for a given analysed_event — the single place this
// project decides what's known. Returns null for anything outside the four
// confirmed shapes (move/cube_double/cube_pass/resignation) so callers skip
// rather than guess; matches decisionKindFor in lib/ingest.ts.
function decisionKindFor(analysedEvent: string): DecisionKind | null {
  switch (analysedEvent) {
    case "move":
      return "checker";
    case "cube_double":
    case "cube_pass":
      return "cube";
    case "resignation":
      return "resignation";
    default:
      return null;
  }
}

function actionLabels(review: Review): { mine: string; best: string } {
  const envelope = review.result;

  if (envelope.analysed_event === "move") {
    const moves = envelope.result.moves;
    const played = moves.find((m) => m.move_played);
    const best = moves.find((m) => m.rank === 1) ?? moves[0];
    return { mine: played?.notation ?? "?", best: best?.notation ?? "?" };
  }

  if (envelope.analysed_event === "resignation") {
    const mine = "resigned";
    const best = envelope.result.should_resign ? "should resign" : "should not resign";
    return { mine, best };
  }

  const cube = envelope.result.cube_analysis;

  if (envelope.analysed_event === "cube_double") {
    const mine = review.double ? "doubled" : "did not double";
    return { mine, best: formatCubeAction(cube.doublers_best_action) };
  }

  const mine = review.take ? "took" : "passed";
  return { mine, best: formatCubeAction(cube.receivers_best_action) };
}

function buildDetail(review: Review): string {
  const { mine, best } = actionLabels(review);
  return review.result.analysed_event === "move"
    ? `played ${mine} → best ${best}`
    : `${mine} → best: ${best}`;
}

function moveNotations(review: Review): { mine: string | null; best: string | null } {
  const envelope = review.result;
  if (envelope.analysed_event !== "move") return { mine: null, best: null };

  const moves = envelope.result.moves;
  const played = moves.find((m) => m.move_played);
  const best = moves.find((m) => m.rank === 1) ?? moves[0];
  return { mine: played?.notation ?? null, best: best?.notation ?? null };
}

// A move_commited event's own rolled_dice is always empty — the roll it used
// lives on the nearest preceding dice_rolled event (or game_started, for the
// very first move of the game).
function findPrecedingRoll(events: GameEvent[], index: number): number[] {
  for (let i = index - 1; i >= 0; i--) {
    const e = events[i];
    if (e.event_type === "dice_rolled" || e.event_type === "game_started") {
      if (e.rolled_dice && e.rolled_dice.length > 0) return e.rolled_dice;
    }
  }
  return [];
}

export function extractDecisions(games: FetchedGame[]): Decision[] {
  const decisions: Decision[] = [];

  for (const game of games) {
    const events = game.data?.data?.events ?? [];

    for (let index = 0; index < events.length; index++) {
      const event = events[index];
      const review = event.reviews?.[0];
      if (!review) continue;

      const metadata = review.result?.result?.metadata;
      if (!metadata?.count_as_decision) continue;

      // Unrecognized analysed_event — skip rather than guess a kind (see
      // decisionKindFor). RESIGNATION-kind decisions fall through this filter
      // naturally further down (MistakesSection only buckets "checker"/
      // "cube"), so they're never folded into either PR total.
      const kind = decisionKindFor(review.result.analysed_event);
      if (kind === null) continue;

      // A non-null error_analysis with a null raw_error is a partial/
      // low-confidence analysis (graded severity, no computed equity-error
      // magnitude — see docs/field-mapping.md) — ungraded, not a zero-error
      // clean play. Excluded entirely here (both PR numerator and
      // denominator), same treatment as count_as_decision: false and an
      // unrecognized analysed_event above, rather than risking Math.abs(null)
      // silently coercing to 0 and counting it as a clean decision.
      const rawError = review.result.result.error_analysis.raw_error;
      if (rawError === null) continue;

      const absError = Math.abs(rawError);
      const isMistake = absError > 0;
      const { mine, best } = moveNotations(review);
      const labels = actionLabels(review);

      decisions.push({
        id: `${game.gameIndex}:${event.id}`,
        gameIndex: game.gameIndex,
        userId: event.user_id,
        color: event.color,
        kind,
        absError,
        isMistake,
        severity: isMistake ? (absError >= BLUNDER_THRESHOLD ? "blunder" : "error") : null,
        detail: buildDetail(review),
        myLabel: labels.mine,
        bestLabel: labels.best,
        // Cube decisions are made before any roll; checker decisions pull the
        // roll from the preceding dice_rolled/game_started event.
        roll: kind === "checker" ? findPrecedingRoll(events, index) : [],
        sourcePositionId: review.source_position?.formatted_value ?? null,
        myMoveNotation: mine,
        bestMoveNotation: best,
      });
    }
  }

  return decisions;
}

export function extractPlayerOptions(games: FetchedGame[]): PlayerOption[] {
  const seen = new Set<string>();

  for (const game of games) {
    const events = game.data?.data?.events ?? [];
    for (const event of events) {
      if (event.user_id) seen.add(event.user_id);
    }
  }

  return Array.from(seen, (userId) => ({ userId }));
}

export function extractGameIndexes(games: FetchedGame[]): number[] {
  return [...new Set(games.map((g) => g.gameIndex))].sort((a, b) => a - b);
}

export interface PRResult {
  totalDecisions: number;
  totalMistakeCount: number;
  activeMistakeCount: number;
  activeMistakeLoss: number;
  effectiveDecisions: number;
  pr: number | null;
}

export function computePR(decisions: Decision[], isTicked: (id: string) => boolean): PRResult {
  const totalDecisions = decisions.length;
  const mistakes = decisions.filter((d) => d.isMistake);
  const totalMistakeCount = mistakes.length;
  const activeMistakes = mistakes.filter((d) => isTicked(d.id));
  const activeMistakeCount = activeMistakes.length;
  const activeMistakeLoss = activeMistakes.reduce((sum, d) => sum + d.absError, 0);
  const effectiveDecisions = totalDecisions - (totalMistakeCount - activeMistakeCount);
  const pr = effectiveDecisions > 0 ? (activeMistakeLoss / effectiveDecisions) * 500 : null;

  return {
    totalDecisions,
    totalMistakeCount,
    activeMistakeCount,
    activeMistakeLoss,
    effectiveDecisions,
    pr,
  };
}

export function combinePR(a: PRResult, b: PRResult): number | null {
  const loss = a.activeMistakeLoss + b.activeMistakeLoss;
  const denom = a.effectiveDecisions + b.effectiveDecisions;
  return denom > 0 ? (loss / denom) * 500 : null;
}
