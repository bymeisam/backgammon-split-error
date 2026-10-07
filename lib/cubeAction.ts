// The correct cube action, worked out from Galaxy's own cube equities
// rather than read from its `doublers_best_action`/`receivers_best_action`
// labels — on about 18k counted old-analysis cube decisions those labels
// are stuck at "roll" while `raw_error` (the grade) follows the equities
// (e.g. decision 629849: ND 0.7922, DT 0.9751, labelled "roll", but not
// doubling is graded BLUNDER −0.183). Galaxy's own site does the same: its
// game review never shows the stored labels and derives the verdict from
// the equities (reports/2026-10-07-galaxy-client-comparison.md).
// Display-only: rawError/severity stay Galaxy's, and the stored
// cubeActionBest column keeps Galaxy's own label.
// See docs/field-mapping.md, "Cube action from the equities".
//
// The rule, from the doubler's side (ND = no_double, DT = double_take,
// DP = double_pass) — Galaxy's own rule: "Too good" if ND > DP, otherwise
// "Double" if DT > ND, otherwise "No Double":
//   ND <= DP, DT <= DP: Double/take if DT > ND, otherwise No double/take
//   ND <= DP, DT >  DP: Double/pass
//   ND >  DP, DT >  DP: Too good/pass
//   ND >  DP, DT <= DP: Too good/take
// Ties: DT == ND -> No double/take; ND == DP -> not too good (Double/pass
// when DT > DP, else No double/take — since 2026-10-07, before that it was
// the too-good branch; 542 counted local rows, e.g. 662455); DT == DP ->
// take. DP is 1 on every counted cube_double row (it's 0.18–0.91 on 89,593
// uncounted pre-roll checks locally), but the rule compares against DP
// rather than a literal 1 so it stays right if that ever changes.
import type { CubeAnalysis, ErrorSeverity, Review } from "@/lib/gameReviewsTypes";

export type DoublerAction =
  | "No double/take"
  | "Double/take"
  | "Double/pass"
  | "Too good/take"
  | "Too good/pass";
export type ReceiverAction = "Take" | "Pass";
export type CubeAction = DoublerAction | ReceiverAction;

type Equities = Pick<CubeAnalysis, "no_double" | "double_take" | "double_pass">;

// Doubler-view equities -> one of the five actions. All three in the
// doubler's own view (as stored on cube_double rows).
export function doublerAction(nd: number, dt: number, dp: number): DoublerAction {
  const take = dt <= dp;
  if (nd > dp) return take ? "Too good/take" : "Too good/pass";
  if (!take) return "Double/pass";
  return dt > nd ? "Double/take" : "No double/take";
}

// The receiver's answer to a double: take if the doubler-view DT <= DP.
export function receiverAction(dt: number, dp: number): ReceiverAction {
  return dt <= dp ? "Take" : "Pass";
}

function isNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

// A cube decision's ND/DT/DP in the doubler's view, or null when the
// equities are missing or the event isn't a cube decision. The one place the
// receiver-sign rule lives: deriveCubeAction below and lib/analysis/galaxy.ts
// (the normalized decision analysis) both use it.
//
// cube_double rows hold the doubler's view, returned as they are. cube_pass
// rows hold the receiver's view, i.e. the doubler's values negated (DP = −1);
// a handful (4 locally, all in matches 33002925/33013316) aren't negated
// (DP = +1). Multiplying by the sign of DP brings both back to the doubler's
// view, so "take if −DT <= −DP" on a negated row is the same test as
// DT <= DP here.
export function doublerViewEquities(
  analysedEvent: string,
  cube: Partial<Equities>
): { nd: number; dt: number; dp: number } | null {
  const { no_double: nd, double_take: dt, double_pass: dp } = cube;
  if (!isNum(nd) || !isNum(dt) || !isNum(dp) || dp === 0) return null;

  if (analysedEvent === "cube_double") return { nd, dt, dp };

  if (analysedEvent === "cube_pass") {
    const sign = Math.sign(dp);
    return { nd: nd * sign, dt: dt * sign, dp: dp * sign };
  }

  return null;
}

// The derived action for a cube decision, or null when the equities are
// missing (then callers fall back to Galaxy's own label). Equities are
// brought to the doubler's view by doublerViewEquities above.
export function deriveCubeAction(analysedEvent: string, cube: Partial<Equities>): CubeAction | null {
  const view = doublerViewEquities(analysedEvent, cube);
  if (!view) return null;
  return analysedEvent === "cube_double"
    ? doublerAction(view.nd, view.dt, view.dp)
    : receiverAction(view.dt, view.dp);
}

// The derived action for a review, if it's a cube review with equities.
export function deriveCubeActionFromReview(review: Review): CubeAction | null {
  const envelope = review.result;
  if (envelope.analysed_event !== "cube_double" && envelope.analysed_event !== "cube_pass") return null;
  const cube = envelope.result.cube_analysis;
  if (!cube) return null;
  return deriveCubeAction(envelope.analysed_event, cube);
}

// ---------------------------------------------------------------------------
// Display wording — Galaxy's own (since 2026-10-07). Display only: the
// stored cubeActionPlayed/cubeActionBest values are unchanged.

// Galaxy's best-action words. "Too good" has a lowercase g, as on Galaxy.
export type CubeBestLabel = "No Double" | "Double" | "Too good" | "Take" | "Pass";

// The best label for a derived action, plus the opponent's half as small
// secondary text — kept for Double and Too good only (Galaxy shows that
// half only in its cube table; the user wants it beside the label too).
export function cubeBestDisplay(action: CubeAction): { label: CubeBestLabel; detail: string | null } {
  switch (action) {
    case "No double/take":
      return { label: "No Double", detail: null };
    case "Double/take":
      return { label: "Double", detail: "opponent should take" };
    case "Double/pass":
      return { label: "Double", detail: "opponent should pass" };
    case "Too good/take":
      return { label: "Too good", detail: "opponent should take" };
    case "Too good/pass":
      return { label: "Too good", detail: "opponent should pass" };
    case "Take":
      return { label: "Take", detail: null };
    case "Pass":
      return { label: "Pass", detail: null };
  }
}

// Stored played labels (lib/mistakes.ts's actionLabels, the values in
// Decision.cubeActionPlayed, plus "resigned" for a resignation) -> Galaxy's
// words. Anything else passes through unchanged.
const PLAYED_LABELS: Record<string, string> = {
  "did not double": "No Double",
  doubled: "Double",
  took: "Take",
  passed: "Pass",
  resigned: "Resign",
};

// The played label for a cube or resignation decision. Galaxy's one
// exception: a no-double check reads "Too good" (not "No Double") when the
// position is too good to double (ND > DP, i.e. the derived action is a
// Too good one) and the severity is none or doubtful.
export function cubePlayedLabel(
  stored: string,
  derived: CubeAction | null,
  severity: ErrorSeverity
): string {
  if (
    stored === "did not double" &&
    (derived === "Too good/take" || derived === "Too good/pass") &&
    (severity === "none" || severity === "doubtful")
  ) {
    return "Too good";
  }
  return Object.hasOwn(PLAYED_LABELS, stored) ? PLAYED_LABELS[stored] : stored;
}
