import type {
  ErrorSeverity as RawErrorSeverity,
  GameReviewsResponse,
  Review,
} from "@/lib/gameReviewsTypes";
import {
  cubeListValue,
  cubeStateFromMatchId,
  doubleOfferFor,
  positionFromOpponent,
  type CubeState,
  type DoubleOffer,
} from "@/lib/cubeState";
import { cubeBestDisplay, cubePlayedLabel, deriveCubeActionFromReview } from "@/lib/cubeAction";
import { decodeGnuMatchId, diceRollFor } from "@/lib/gnuMatchId";
import type { DecisionReviewStatus, DecisionTagRef } from "@/lib/review/types";

export interface FetchedGame {
  gameIndex: number;
  data: GameReviewsResponse;
}

export type DecisionKind = "checker" | "cube" | "resignation";
// Galaxy's tiers, minus "Best" (error_severity none), which is null here:
// "good" = doubtful, "error", "blunder". See severityFromErrorSeverity.
export type Severity = "good" | "error" | "blunder";

// The single mapping from Galaxy's own error_analysis.error_severity to
// this app's Severity — both extractDecisions (live-fetch: /matches,
// /sources/galaxy/matches) and lib/decisionFromRow.ts's severityFor (DB-row:
// replay, /mistakes, reading the errorSeverity column ingest already
// populates from this exact raw field) now go through this one function,
// after an audit found they'd been computing severity two different ways:
// this path re-derived it from a local absError >= 0.08 threshold instead
// of reading Galaxy's own classification, and could disagree with it —
// confirmed against real data, e.g. decision id 7315: absError 0.0799
// (just under 0.08, so the old threshold said "error") while Galaxy's own
// error_severity is "blunder" (see lib/__fixtures__/galaxy-payloads/
// blunder-below-0.08-threshold.json, reports/2026-10-01-decision-raw-
// field-audit.md finding #1). Galaxy's own tiers, as its site names them:
// none = "Best" (null here), doubtful = "Good", error = "Error", blunder =
// "Blunder". Since 2026-10-07 DOUBTFUL is its own mild "good" tier, not an
// error: it's left out of the per-match mistake lists (partitionMistakes
// below), and so is none (since 2026-10-08, isListedMistake). Before that it was folded into "error". PR math doesn't read
// severity at all (it's equity-based), so it's unaffected.
export function severityFromErrorSeverity(severity: RawErrorSeverity): Severity | null {
  switch (severity) {
    case "blunder":
      return "blunder";
    case "error":
      return "error";
    case "doubtful":
      return "good";
    case "none":
      return null;
  }
}

export interface Decision {
  id: string;
  gameIndex: number;
  userId: string;
  color: string;
  kind: DecisionKind;
  absError: number;
  isMistake: boolean;
  severity: Severity | null;
  myLabel: string;
  // For a cube decision this is the action derived from Galaxy's equities
  // (lib/cubeAction.ts), not Galaxy's own label, in Galaxy's wording — see
  // displayLabels below.
  bestLabel: string;
  // Small grey secondary text after bestLabel: the opponent's half of a
  // Double/Too good best action ("opponent should take"). Null/absent
  // otherwise.
  bestDetail?: string | null;
  roll: number[];
  // The value in a cube row's square in the decision lists, shown instead of
  // dice (lib/cubeState.ts's cubeListValue). Null/absent for checker and
  // resignation rows, or when the Match ID doesn't decode.
  cubeSquareValue?: number | null;
  sourcePositionId: string | null;
  myMoveNotation: string | null;
  bestMoveNotation: string | null;
  // Doubling-cube state entering this decision, from its own GNU Match ID,
  // relative to the player drawn at the bottom — see lib/cubeState.ts. Null
  // when the Match ID is missing or doesn't decode.
  cubeState: CubeState | null;
  // True when sourcePositionId is drawn from the other player's side, not
  // the actor's — a take/pass (cube_pass), whose stored position is the
  // doubler's. BoardPanel flips the board (and cubeState) for these so the
  // decision-maker is at the bottom. See lib/cubeState.ts.
  positionFromOpponent: boolean;
  // On a take/pass, the double it answers (value offered, redouble or not,
  // took/passed); null on every other decision. The replay labels the step
  // with it.
  doubleOffer: DoubleOffer | null;
  // The user's own note on this decision (DecisionNote), null/absent when
  // there isn't one. DB-row paths (lib/decisionFromRow.ts) read it from the
  // joined row; the live path (extractDecisions below) has no DB row, so
  // MistakesSection attaches it afterwards via /api/decision-notes — see
  // attachNotes below.
  note?: string | null;
  // The real Decision.id in whichever DB served this decision — what a note
  // is saved against (POST /api/decisions/[id]/note). Separate from `id`
  // above, which stays the list/selection key (and on the live path is a
  // synthetic `${gameIndex}:${eventId}`, not a DB id at all). Null/absent
  // when the decision isn't in the DB (live path, match not ingested), in
  // which case no note UI renders.
  dbDecisionId?: number | null;
  // The decision's spaced-repetition card (ReviewCard), null/absent when it
  // isn't in review. Set only on DB-backed paths, never on /sources/galaxy.
  reviewCard?: DecisionReviewStatus | null;
  // Whether it can become a card (lib/review/eligibility.ts). Absent/false
  // where it wasn't worked out.
  reviewEligible?: boolean;
  // The user's tags on this decision (DecisionTag), absent/empty when none.
  tags?: DecisionTagRef[];
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

// Exported for displayLabels' callers' tests; see moveNotations below.
export function actionLabels(review: Review): { mine: string; best: string } {
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

// The labels a decision shows: actionLabels() above, in Galaxy's wording
// for cube and resignation decisions (lib/cubeAction.ts) — "No Double",
// "Double", "Take", "Pass", "Resign", and "Too good" for a no-double check
// that was too good to double. A cube decision's "best" is the action
// derived from Galaxy's own equities (Galaxy's best-action label is
// unreliable on old analyses), with the opponent's take/pass half as
// bestDetail. Shared by the live path (extractDecisions below) and the
// DB-row path (lib/analysis/galaxyFields.ts's galaxyLabels), both reading
// the event itself — nothing is stored (the cubeActionPlayed/cubeActionBest
// columns were dropped 2026-10-07).
export function displayLabels(review: Review): { mine: string; best: string; bestDetail: string | null } {
  const labels = actionLabels(review);
  const severity: RawErrorSeverity = review.result.result.error_analysis?.error_severity ?? "none";
  const event = review.result.analysed_event;
  if (event === "move") return { ...labels, bestDetail: null };
  const derived = deriveCubeActionFromReview(review);
  const mine = cubePlayedLabel(labels.mine, derived, severity);
  if (!derived) return { mine, best: labels.best, bestDetail: null };
  const best = cubeBestDisplay(derived);
  return { mine, best: best.label, bestDetail: best.detail };
}

// Exported for lib/analysis/galaxyFields.ts, which builds the same values
// straight from a stored DB row's raw JSON (a single already-ingested event)
// rather than from a live game_reviews fetch — reuses this exact logic
// instead of duplicating it, so the two paths can't silently diverge.
export function moveNotations(review: Review): { mine: string | null; best: string | null } {
  const envelope = review.result;
  if (envelope.analysed_event !== "move") return { mine: null, best: null };

  const moves = envelope.result.moves;
  const played = moves.find((m) => m.move_played);
  const best = moves.find((m) => m.rank === 1) ?? moves[0];
  return { mine: played?.notation ?? null, best: best?.notation ?? null };
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
      const labels = displayLabels(review);
      const matchId = decodeGnuMatchId(review.source_match?.formatted_value);

      decisions.push({
        id: `${game.gameIndex}:${event.id}`,
        gameIndex: game.gameIndex,
        userId: event.user_id,
        color: event.color,
        kind,
        absError,
        isMistake,
        severity: severityFromErrorSeverity(review.result.result.error_analysis.error_severity),
        myLabel: labels.mine,
        bestLabel: labels.best,
        bestDetail: labels.bestDetail,
        // The Match ID's dice for a checker move; none for cube decisions
        // (made before the roll) or resignations — the same rule the DB-row
        // path uses (lib/gnuMatchId.ts's diceRollFor). Until 2026-10-07 this
        // scanned back to the preceding dice_rolled/game_started event,
        // which on the DB path (/matches, events rebuilt from stored rows)
        // depended on row order and could pick up the wrong roll.
        roll: diceRollFor(review.result.analysed_event, matchId),
        sourcePositionId: review.source_position?.formatted_value ?? null,
        myMoveNotation: mine,
        bestMoveNotation: best,
        cubeState: cubeStateFromMatchId(matchId),
        positionFromOpponent: positionFromOpponent(review.result.analysed_event, matchId),
        doubleOffer: doubleOfferFor(review.result.analysed_event, matchId, review.take),
        cubeSquareValue: cubeListValue(review.result.analysed_event, matchId, review.double),
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

// One player's decisions, optionally narrowed to a single game ("all" =
// every game). Null userId (no player resolved) matches nothing.
export function scopeDecisions(
  decisions: Decision[],
  userId: string | null,
  game: "all" | number
): Decision[] {
  return decisions.filter(
    (d) => d.userId === userId && (game === "all" || d.gameIndex === game)
  );
}

export interface PartitionedDecisions {
  checkerDecisions: Decision[];
  cubeDecisions: Decision[];
  // Listed mistakes only (isListedMistake: no Good tier), each sorted by
  // absError descending.
  checkerMistakes: Decision[];
  cubeMistakes: Decision[];
  // Both kinds merged, absError descending (ties: checker before cube).
  allMistakes: Decision[];
}

// Whether a decision is listed as a mistake on the match pages: any error
// at all that Galaxy grades Error or Blunder. Not Galaxy's mild "Good"
// tier (doubtful), which isn't an error (since 2026-10-07), and not a
// decision Galaxy grades none (Best, severity null; since 2026-10-08): as on
// Galaxy, a Best decision is never among the mistakes, even when its
// rawError is positive (the played move beat Galaxy's rank 1). PR doesn't
// use this: computePR still counts every isMistake decision, so hiding
// these rows changes no PR.
export function isListedMistake(d: Decision): boolean {
  return d.isMistake && (d.severity === "error" || d.severity === "blunder");
}

// Splits decisions into checker / cube (resignations belong to neither —
// they don't count toward either PR), and each side's listed mistakes
// (isListedMistake) worst-first.
export function partitionMistakes(decisions: Decision[]): PartitionedDecisions {
  const byErrorDesc = (a: Decision, b: Decision) => b.absError - a.absError;
  const checkerDecisions = decisions.filter((d) => d.kind === "checker");
  const cubeDecisions = decisions.filter((d) => d.kind === "cube");
  const checkerMistakes = checkerDecisions.filter(isListedMistake).sort(byErrorDesc);
  const cubeMistakes = cubeDecisions.filter(isListedMistake).sort(byErrorDesc);
  return {
    checkerDecisions,
    cubeDecisions,
    checkerMistakes,
    cubeMistakes,
    allMistakes: [...checkerMistakes, ...cubeMistakes].sort(byErrorDesc),
  };
}

export function formatPR(pr: number | null): string {
  return pr === null ? "—" : pr.toFixed(2);
}
