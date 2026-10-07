// Galaxy's readers for the per-decision values the app shows but doesn't
// store: colour, event type, roll, cube, labels and move notations, and the
// board-frame fields. Each reads only the stored Galaxy event
// (`Decision.raw`, the untouched payload — never modified) and reuses the
// one rule for its value, so the DB-row path (lib/decisionFromRow.ts) and
// the live path (lib/mistakes.ts's extractDecisions, which applies the same
// rules to a fetched event) always agree:
//   roll       lib/gnuMatchId.ts's diceRollFor (the Match ID's dice)
//   cube       lib/cubeState.ts's cubeStateFromMatchId (the Match ID's cube)
//   labels     lib/mistakes.ts's displayLabels + moveNotations
//   board frame  lib/cubeState.ts's positionFromOpponent / doubleOfferFor /
//              cubeListValue
//   match context  the Match ID's length (effectiveMatchLength), scores
//              (seen from the actor, actorPlayerFor) and crawfordStateFor
// Called only through lib/analysis/index.ts's dispatchers, which pick these
// for Match.source "galaxy". Pure: no DB, no network.
//
// These replace the dropped Decision columns color, analysedEvent, roll,
// cubeValue/cubeOwnerUserId/cubeConfident, movePlayed/moveBest and
// cubeActionPlayed/cubeActionBest (2026-10-07; reports/2026-10-07-column-
// audit.md, docs/field-mapping.md "Derived from raw").
import type { Review } from "@/lib/gameReviewsTypes";
import {
  actorPlayerFor,
  crawfordStateFor,
  decodeGnuMatchId,
  diceRollFor,
  effectiveMatchLength,
  type DecodedMatchId,
} from "@/lib/gnuMatchId";
import { cubeListValue, cubeStateFromMatchId, doubleOfferFor, positionFromOpponent, type CubeState } from "@/lib/cubeState";
import { displayLabels, moveNotations } from "@/lib/mistakes";
import type { DecisionBoardFrame, DecisionLabels, DecisionMatchContext } from "@/lib/analysis/types";

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// raw.reviews[0] with its result envelope, or null if either is missing.
export function galaxyReview(raw: unknown): Review | null {
  if (!isObject(raw) || !Array.isArray(raw.reviews)) return null;
  const review = raw.reviews[0];
  if (!isObject(review) || !isObject(review.result)) return null;
  return review as unknown as Review;
}

// reviews[0].result.analysed_event ("move" / "cube_double" / "cube_pass" /
// "resignation"), or null. Replaces Decision.analysedEvent.
export function galaxyAnalysedEvent(raw: unknown): string | null {
  const event = galaxyReview(raw)?.result.analysed_event;
  return typeof event === "string" ? event : null;
}

// event.color ("black" / "white", often "" on cube rows), "" when absent.
// Replaces Decision.color, which equalled it on every row.
export function galaxyColor(raw: unknown): string {
  return isObject(raw) && typeof raw.color === "string" ? raw.color : "";
}

// The decision's own GNU Match ID (reviews[0].source_match.formatted_value),
// decoded, or null.
export function galaxyMatchState(raw: unknown): DecodedMatchId | null {
  return decodeGnuMatchId(galaxyReview(raw)?.source_match?.formatted_value);
}

export function galaxyRoll(raw: unknown): number[] {
  return diceRollFor(galaxyAnalysedEvent(raw), galaxyMatchState(raw));
}

export function galaxyCubeState(raw: unknown): CubeState | null {
  return cubeStateFromMatchId(galaxyMatchState(raw));
}

// Null when there's no review to read (nothing to label).
export function galaxyLabels(raw: unknown): DecisionLabels | null {
  const review = galaxyReview(raw);
  if (!review) return null;
  const { mine, best, bestDetail } = displayLabels(review);
  const notations = moveNotations(review);
  return { mine, best, bestDetail, myMoveNotation: notations.mine, bestMoveNotation: notations.best };
}

export function galaxyBoardFrame(raw: unknown): DecisionBoardFrame {
  const review = galaxyReview(raw);
  const event = review?.result.analysed_event ?? "";
  const m = galaxyMatchState(raw);
  return {
    positionFromOpponent: positionFromOpponent(event, m),
    doubleOffer: doubleOfferFor(event, m, review?.take),
    cubeSquareValue: cubeListValue(event, m, review?.double),
  };
}

// The match situation from the decision-maker's view: the actor is the dice
// owner on a move and the turn on a cube decision (lib/gnuMatchId.ts's
// actorPlayerFor — on a take/pass the turn is the receiver). Null without a
// decodable Match ID or for a resignation (no reliable actor).
export function galaxyMatchContext(raw: unknown): DecisionMatchContext | null {
  const m = galaxyMatchState(raw);
  const event = galaxyAnalysedEvent(raw);
  if (!m || !event) return null;
  const actor = actorPlayerFor(event, m);
  if (actor === null) return null;
  const matchLength = effectiveMatchLength(m);
  if (matchLength === 0) {
    return { matchLength: 0, deciderScore: null, opponentScore: null, crawford: "none" };
  }
  return {
    matchLength,
    deciderScore: m.score[actor],
    opponentScore: m.score[actor === 0 ? 1 : 0],
    crawford: crawfordStateFor(m),
  };
}
