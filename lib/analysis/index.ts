// The single entry point for every per-decision value derived from `raw`:
// the normalized engine analysis (lib/analysis/types.ts's DecisionAnalysis)
// and the display values that used to be Decision columns (colour, roll,
// cube, labels and move notations, board frame — dropped 2026-10-07, see
// reports/2026-10-07-column-audit.md). Nothing here is stored: each value is
// derived on demand from the decision's own `raw` by the reader for its
// Match.source. Callers (lib/decisionFromRow.ts, the replay, the review
// cards, ingest's check) never pick a source's reader themselves.
//
// Adding a source (e.g. an XG import): write its translator and field
// readers next to lib/analysis/galaxy.ts / galaxyFields.ts, filling the same
// shapes, and add a case to each switch below. Every reader is pure and only
// reads `raw`; `raw` is the source's untouched payload and is never modified
// or written back.
//
// See docs/field-mapping.md, "Normalized decision analysis (derived, not
// stored)" and "Derived from raw".
import { galaxyAnalysis } from "@/lib/analysis/galaxy";
import {
  galaxyBoardFrame,
  galaxyColor,
  galaxyCubeState,
  galaxyLabels,
  galaxyMatchContext,
  galaxyRoll,
} from "@/lib/analysis/galaxyFields";
import type {
  DecisionAnalysis,
  DecisionBoardFrame,
  DecisionLabels,
  DecisionMatchContext,
} from "@/lib/analysis/types";
import type { CubeState } from "@/lib/cubeState";

export type DecisionRawInput = {
  // Match.source of the decision's match ("galaxy").
  source: string;
  // Decision.raw, the source's stored event.
  raw: unknown;
};

// Whether a source has a translator (getDecisionAnalysis below) at all.
// The review feature's eligibility rule checks it (lib/review/eligibility.ts).
// Keep in step with the switch in getDecisionAnalysis.
export function hasAnalysisTranslator(source: string): boolean {
  return source === "galaxy";
}

// Null for an unknown source, a resignation, or a payload the translator
// can't read.
export function getDecisionAnalysis({ source, raw }: DecisionRawInput): DecisionAnalysis | null {
  switch (source) {
    case "galaxy":
      return galaxyAnalysis(raw);
    default:
      return null;
  }
}

// The actor's colour ("black" / "white"), "" when the source doesn't give
// one (Galaxy leaves it blank on most cube rows) or the source is unknown.
export function decisionColor({ source, raw }: DecisionRawInput): string {
  switch (source) {
    case "galaxy":
      return galaxyColor(raw);
    default:
      return "";
  }
}

// The dice a checker move was played with, higher die first (6-3, as
// Galaxy's client shows them — display only); [] for cube decisions (made
// before the roll), resignations, an unknown source, or an unreadable roll.
export function decisionRoll({ source, raw }: DecisionRawInput): number[] {
  switch (source) {
    case "galaxy":
      return galaxyRoll(raw);
    default:
      return [];
  }
}

// The cube entering the decision, relative to the stored position's
// on-roll player (lib/cubeState.ts). Null when unknown.
export function decisionCubeState({ source, raw }: DecisionRawInput): CubeState | null {
  switch (source) {
    case "galaxy":
      return galaxyCubeState(raw);
    default:
      return null;
  }
}

// Display labels and move notations. Null when the payload has no analysis
// to label, or the source is unknown.
export function decisionLabels({ source, raw }: DecisionRawInput): DecisionLabels | null {
  switch (source) {
    case "galaxy":
      return galaxyLabels(raw);
    default:
      return null;
  }
}

// How the board frames the decision (take/pass flip, the double offered,
// the list's cube square).
export function decisionBoardFrame({ source, raw }: DecisionRawInput): DecisionBoardFrame {
  switch (source) {
    case "galaxy":
      return galaxyBoardFrame(raw);
    default:
      return { positionFromOpponent: false, doubleOffer: null, cubeSquareValue: null };
  }
}

// The match situation at the decision from the decision-maker's view
// (length, scores, Crawford). Null when unknown.
export function decisionMatchContext({ source, raw }: DecisionRawInput): DecisionMatchContext | null {
  switch (source) {
    case "galaxy":
      return galaxyMatchContext(raw);
    default:
      return null;
  }
}
