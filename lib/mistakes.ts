import type { GameReviewsResponse, Review } from "@/lib/gameReviewsTypes";

export const BLUNDER_THRESHOLD = 0.08;

export interface FetchedGame {
  gameIndex: number;
  data: GameReviewsResponse;
}

export type DecisionKind = "checker" | "cube";
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
}

export interface PlayerOption {
  key: string;
  userId: string;
  color: string;
}

function formatCubeAction(action: string): string {
  return action.replace(/_/g, " ");
}

function buildDetail(review: Review): string {
  const envelope = review.result;

  if (envelope.analysed_event === "move") {
    const moves = envelope.result.moves;
    const played = moves.find((m) => m.move_played);
    const best = moves.find((m) => m.rank === 1) ?? moves[0];
    return `played ${played?.notation ?? "?"} → best ${best?.notation ?? "?"}`;
  }

  const cube = envelope.result.cube_analysis;

  if (envelope.analysed_event === "cube_double") {
    const actual = review.double ? "doubled" : "did not double";
    return `${actual} → best: ${formatCubeAction(cube.doublers_best_action)}`;
  }

  const actual = review.take ? "took" : "passed";
  return `${actual} → best: ${formatCubeAction(cube.receivers_best_action)}`;
}

export function extractDecisions(games: FetchedGame[]): Decision[] {
  const decisions: Decision[] = [];

  for (const game of games) {
    const events = game.data?.data?.events ?? [];

    for (const event of events) {
      const review = event.reviews?.[0];
      if (!review) continue;

      const metadata = review.result?.result?.metadata;
      if (!metadata?.count_as_decision) continue;

      const kind: DecisionKind = review.result.analysed_event === "move" ? "checker" : "cube";
      const absError = Math.abs(review.result.result.error_analysis.raw_error);
      const isMistake = absError > 0;

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
      });
    }
  }

  return decisions;
}

export function extractPlayerOptions(games: FetchedGame[]): PlayerOption[] {
  const seen = new Map<string, PlayerOption>();

  for (const game of games) {
    const events = game.data?.data?.events ?? [];
    for (const event of events) {
      if (!event.user_id) continue;
      const key = `${event.user_id}::${event.color}`;
      if (!seen.has(key)) {
        seen.set(key, { key, userId: event.user_id, color: event.color });
      }
    }
  }

  return Array.from(seen.values());
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
