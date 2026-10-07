// A review card's answer options and their grading, built from the
// normalized decision analysis (lib/analysis/types.ts) — never from a
// source's raw format. Pure, so the server (which grades authoritatively
// when an answer is saved) and the client (which reveals the back of the
// card) use the same rules. See docs/field-mapping.md, "Review cards".
//
// Correct means within CORRECT_LOSS_THRESHOLD (0.02, Galaxy's good/error
// boundary) of the best.
//
// Checker: every candidate (3–5 moves, always including the move played),
// keyed by its move notation. Loss is the candidate's own `loss`, measured
// against the true best by equity (the analysis is sorted best first).
//
// Cube, doubler: five options in a fixed order. Each is a doubling part
// (double or not) plus a take/pass part (the opponent's answer):
//   No Double / Take   (no double, take)
//   Double / Take      (double,    take)
//   Double / Pass      (double,    pass)
//   Too good / Pass    (no double, pass)
//   Too good / Take    (no double, take)
// Graded on the doubler-view ND / DT / DP:
//   - doubling part: not doubling is worth ND; doubling is worth min(DT, DP)
//     (the receiver answers correctly). Its loss is chosen − max of the two.
//   - take/pass part: take is right when DT ≤ DP, pass otherwise; when
//     |DT − DP| ≤ the threshold either is right.
//   - correct: doubling loss ≥ −threshold AND the take/pass part is right.
//   The option's shown loss is the doubling loss plus, when its take/pass
//   part is the strictly wrong one (DT ≤ DP → pass, DT > DP → take), −|DT − DP|.
//   "No Double / Take" and "Too good / Take" have the same two parts, so
//   they always grade the same; the best option shown is lib/cubeAction.ts's
//   doublerAction (its tie rules: too good needs ND > DP strictly, DT == ND
//   is No Double, DT == DP is Take).
//
// Cube, receiver: Take and Pass. Take is right when the doubler-view
// DT ≤ DP. The wrong answer loses |DT − DP|; correct within the threshold.
import type { CheckerAnalysis, CubeAnalysis, DecisionAnalysis } from "@/lib/analysis/types";
import { doublerAction, receiverAction, type DoublerAction } from "@/lib/cubeAction";
import { CORRECT_LOSS_THRESHOLD } from "@/lib/settings";

// A hair of tolerance for float noise in min/max/subtraction (equities are
// 4-decimal values; an exactly −0.02 loss must count as correct).
const EPS = 1e-9;

export type CubeOptionKey = "nd_take" | "dt" | "dp" | "tg_pass" | "tg_take" | "take" | "pass";

export interface ReviewOption {
  // Stable key: the move notation (checker) or a CubeOptionKey. Stored as
  // ReviewLog.chosen.
  key: string;
  label: string;
  // ≤ 0; 0 for the best.
  loss: number;
  correct: boolean;
}

export interface GradedOptions {
  // In display order (checker: shuffled; cube: fixed).
  options: ReviewOption[];
  // The best option's key.
  bestKey: string;
}

function round4(x: number): number {
  const r = Math.round(x * 1e4) / 1e4;
  return r === 0 ? 0 : r;
}

function withinThreshold(loss: number): boolean {
  return loss >= -CORRECT_LOSS_THRESHOLD - EPS;
}

// --- Checker -----------------------------------------------------------

export function checkerOptions(analysis: CheckerAnalysis): GradedOptions {
  const options = analysis.candidates.map((c) => ({
    key: c.move,
    label: c.move,
    loss: c.loss,
    correct: withinThreshold(c.loss),
  }));
  return { options, bestKey: analysis.candidates[0].move };
}

// --- Cube --------------------------------------------------------------

const DOUBLER_OPTIONS: { key: CubeOptionKey; label: string; doubles: boolean; takes: boolean }[] = [
  { key: "nd_take", label: "No Double / Take", doubles: false, takes: true },
  { key: "dt", label: "Double / Take", doubles: true, takes: true },
  { key: "dp", label: "Double / Pass", doubles: true, takes: false },
  { key: "tg_pass", label: "Too good / Pass", doubles: false, takes: false },
  { key: "tg_take", label: "Too good / Take", doubles: false, takes: true },
];

const DOUBLER_ACTION_KEY: Record<DoublerAction, CubeOptionKey> = {
  "No double/take": "nd_take",
  "Double/take": "dt",
  "Double/pass": "dp",
  "Too good/pass": "tg_pass",
  "Too good/take": "tg_take",
};

// The take/pass part: whether `takes` is right, and its loss (0 when it's
// the strictly right answer).
function takePart(takes: boolean, dt: number, dp: number): { right: boolean; loss: number } {
  const takeIsRight = dt <= dp;
  const gap = Math.abs(dt - dp);
  const strictlyRight = takes === takeIsRight;
  return {
    right: strictlyRight || gap <= CORRECT_LOSS_THRESHOLD + EPS,
    loss: strictlyRight ? 0 : -gap,
  };
}

export function doublerOptions(nd: number, dt: number, dp: number): GradedOptions {
  const doubleValue = Math.min(dt, dp);
  const best = Math.max(nd, doubleValue);
  const options = DOUBLER_OPTIONS.map((o) => {
    const doublingLoss = (o.doubles ? doubleValue : nd) - best;
    const tp = takePart(o.takes, dt, dp);
    return {
      key: o.key,
      label: o.label,
      loss: round4(doublingLoss + tp.loss),
      correct: withinThreshold(doublingLoss) && tp.right,
    };
  });
  return { options, bestKey: DOUBLER_ACTION_KEY[doublerAction(nd, dt, dp)] };
}

export function receiverOptions(dt: number, dp: number): GradedOptions {
  const options = (["take", "pass"] as const).map((key) => {
    const tp = takePart(key === "take", dt, dp);
    return {
      key,
      label: key === "take" ? "Take" : "Pass",
      loss: round4(tp.loss),
      correct: tp.right,
    };
  });
  return { options, bestKey: receiverAction(dt, dp) === "Take" ? "take" : "pass" };
}

export function cubeOptions(analysis: CubeAnalysis): GradedOptions {
  return analysis.role === "doubler"
    ? doublerOptions(analysis.nd, analysis.dt, analysis.dp)
    : receiverOptions(analysis.dt, analysis.dp);
}

// --- Both --------------------------------------------------------------

// Options in grading order (checker: best first; cube: the fixed order).
export function reviewOptions(analysis: DecisionAnalysis): GradedOptions {
  return analysis.kind === "checker" ? checkerOptions(analysis) : cubeOptions(analysis);
}

// Fisher–Yates with an injectable random source (tests pass a seeded one).
export function shuffled<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Options as a card shows them: checker candidates in random order (so the
// position in the list doesn't give the answer away), cube options in their
// fixed order.
export function displayOptions(analysis: DecisionAnalysis, random: () => number = Math.random): GradedOptions {
  const graded = reviewOptions(analysis);
  return analysis.kind === "checker" ? { ...graded, options: shuffled(graded.options, random) } : graded;
}

export interface Grade {
  correct: boolean;
  loss: number;
}

// Grades a chosen key against the analysis; null when the key isn't one of
// the card's options.
export function gradeAnswer(analysis: DecisionAnalysis, chosen: string): Grade | null {
  const option = reviewOptions(analysis).options.find((o) => o.key === chosen);
  return option ? { correct: option.correct, loss: option.loss } : null;
}

// The option the game's player actually chose, when it can be told from the
// analysis: the played candidate for a checker move. Cube decisions don't
// record the opponent's half, so the card shows the played label instead
// (lib/analysis/index.ts's decisionLabels).
export function playedCheckerKey(analysis: CheckerAnalysis): string | null {
  return analysis.candidates.find((c) => c.played)?.move ?? null;
}
