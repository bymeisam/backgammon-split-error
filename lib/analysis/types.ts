// Normalized decision analysis: a source-neutral, versioned view of a
// decision's engine analysis (checker candidates, or cube equities) for the
// review cards. Not stored: it's derived on demand from the decision's own
// `raw` by lib/analysis/index.ts's getDecisionAnalysis, which picks the
// translator for the match's source (lib/analysis/galaxy.ts for Galaxy; a
// future XG import adds its own, filling this same shape).
//
// `v` versions the shape. A change to the shape, or to how a translator
// fills it, bumps `v` so consumers can tell. See docs/field-mapping.md,
// "Normalized decision analysis (derived, not stored)".

import type { DoubleOffer } from "@/lib/cubeState";

export type AnalysisSource = "galaxy";

// Outcome probabilities after a candidate move, from the mover's view.
// `win` is all wins (gammons and backgammons included), as the engine gives it.
export type CandidateProbs = {
  win: number;
  winG: number;
  winBG: number;
  loseG: number;
  loseBG: number;
};

export type CheckerCandidate = {
  // The source's own move notation, unchanged (e.g. "14/12* 12/8", "Bar/22*").
  move: string;
  // The source's own rank, for reference only. Not the sort key: Galaxy's
  // rank isn't always in equity order (see docs/field-mapping.md).
  rank: number;
  equity: number;
  // equity − the best candidate's equity: ≤ 0, and 0 for the best.
  loss: number;
  played: boolean;
  probs: CandidateProbs | null;
};

export type CheckerAnalysis = {
  v: 1;
  source: AnalysisSource;
  kind: "checker";
  // Sorted by equity, best first; exact-equity ties by the source's rank.
  candidates: CheckerCandidate[];
};

export type CubeRole = "doubler" | "receiver";

export type CubeAnalysis = {
  v: 1;
  source: AnalysisSource;
  kind: "cube";
  // Whose decision: the doubler (double / no double) or the receiver
  // (take / pass).
  role: CubeRole;
  // No double, double/take and double/pass equities, always in the
  // DOUBLER's view — also on receiver rows, which are sign-normalized once
  // by the translator.
  nd: number;
  dt: number;
  dp: number;
};

export type DecisionAnalysis = CheckerAnalysis | CubeAnalysis;

// A decision's display labels, derived from `raw` by the source's reader
// (lib/analysis/galaxyFields.ts for Galaxy) — not stored. `mine`/`best` are
// what the lists and MoveDelta show (move notation for a checker move, the
// source's wording for cube and resignation decisions); `bestDetail` is the
// small secondary text after a cube decision's best action; the notations
// are the played and best candidate moves (null outside checker moves).
export type DecisionLabels = {
  mine: string;
  best: string;
  bestDetail: string | null;
  myMoveNotation: string | null;
  bestMoveNotation: string | null;
};

// How the board frames a decision (see lib/mistakes.ts's Decision for each
// field), derived from `raw`.
export type DecisionBoardFrame = {
  positionFromOpponent: boolean;
  doubleOffer: DoubleOffer | null;
  cubeSquareValue: number | null;
};

// The match situation at a decision, from the decision-maker's view, derived
// from `raw` (the Galaxy reader decodes the decision's own GNU Match ID) —
// not stored. The review cards show it ("5-point match · you 3 – opp 2 ·
// Crawford"). matchLength 0 = money game, with both scores null and
// crawford "none".
export type DecisionMatchContext = {
  matchLength: number;
  deciderScore: number | null;
  opponentScore: number | null;
  crawford: "none" | "crawford" | "post_crawford";
};
