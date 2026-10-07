// Decision.analysis: a source-neutral, versioned copy of a decision's engine
// analysis (checker candidates, or cube equities). The review cards read
// only this, never a source's own `raw` payload. Each data source gets its
// own translator that fills this same shape — lib/analysis/galaxy.ts for
// Galaxy; a future XG import would add its own. Read it back through
// lib/analysis/read.ts's readAnalysis, which validates the shape and `v`.
//
// `v` versions the shape. A change to the shape (or to how a translator
// fills it) bumps `v`; the backfill (scripts/backfill-decision-analysis.ts)
// rewrites every row whose stored value differs, and readAnalysis returns
// null for an unknown version. See docs/field-mapping.md, "Decision.analysis".

export const ANALYSIS_VERSION = 1;

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
