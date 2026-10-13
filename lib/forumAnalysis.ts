// The engine analysis a forum post shows under a game-sourced position, as a
// quiz: the ranked options (checker) or the cube equities and best action
// (cube), and NOTHING about what was played in the game. The post page
// (app/forum/[id]/page.tsx) builds it on the server from the decision's raw
// (lib/analysis's getDecisionAnalysis) and passes only this sanitized object
// to the client panel (DecisionAnalysisPanel), so the poster's own move
// never reaches the browser.
//
// What is dropped, and why:
// - checker: each candidate's `played` flag (the poster's move), its `probs`
//   (not shown) and its `rank` (the panel numbers rows by position; the
//   source's rank isn't always in equity order).
// - cube: `role` (not needed: the best label is worked out here), and the
//   played action, which the analysis doesn't carry in the first place.
import { getDecisionAnalysis, type DecisionRawInput } from "@/lib/analysis";
import type { DecisionAnalysis } from "@/lib/analysis/types";
import { cubeBestDisplay, doublerAction, receiverAction, type CubeAction } from "@/lib/cubeAction";

export type ForumCheckerOption = {
  move: string;
  equity: number;
  // equity − the best option's equity: ≤ 0, and 0 for the best.
  loss: number;
};

export type ForumCubeCell = "nd" | "dt" | "dp";

export type ForumDecisionAnalysis =
  | { kind: "checker"; options: ForumCheckerOption[] }
  | {
      kind: "cube";
      // Doubler's view, as everywhere else (lib/analysis/types.ts).
      nd: number;
      dt: number;
      dp: number;
      // The best action's label ("Double", "Take", …) and its small
      // secondary text ("opponent should take"), from lib/cubeAction.ts.
      best: string;
      bestDetail: string | null;
      // Which equity the best action lands on, for the highlight.
      bestCell: ForumCubeCell;
    };

function bestCellFor(action: CubeAction): ForumCubeCell {
  switch (action) {
    case "No double/take":
    case "Too good/take":
    case "Too good/pass":
      return "nd";
    case "Double/take":
    case "Take":
      return "dt";
    case "Double/pass":
    case "Pass":
      return "dp";
  }
}

// The sanitized analysis, or null when there is none (null input).
export function forumAnalysisFrom(analysis: DecisionAnalysis | null): ForumDecisionAnalysis | null {
  if (!analysis) return null;
  if (analysis.kind === "checker") {
    // Explicit fields only: never spread a candidate, so `played` can't
    // ride along.
    return {
      kind: "checker",
      options: analysis.candidates.map((c) => ({ move: c.move, equity: c.equity, loss: c.loss })),
    };
  }
  const action: CubeAction =
    analysis.role === "doubler"
      ? doublerAction(analysis.nd, analysis.dt, analysis.dp)
      : receiverAction(analysis.dt, analysis.dp);
  const { label, detail } = cubeBestDisplay(action);
  return {
    kind: "cube",
    nd: analysis.nd,
    dt: analysis.dt,
    dp: analysis.dp,
    best: label,
    bestDetail: detail,
    bestCell: bestCellFor(action),
  };
}

// One attached position's analysis input: its source decision's raw and its
// match's source, or null for a built (MANUAL) position.
export type ForumAnalysisSource = DecisionRawInput | null;

// The analysis for each of a post's positions, in order. All null when the
// author hid the analysis; null for a built position or a decision with no
// readable analysis.
export function forumPostAnalyses(
  hideAnalysis: boolean,
  sources: ForumAnalysisSource[]
): (ForumDecisionAnalysis | null)[] {
  if (hideAnalysis) return sources.map(() => null);
  return sources.map((source) => (source ? forumAnalysisFrom(getDecisionAnalysis(source)) : null));
}
