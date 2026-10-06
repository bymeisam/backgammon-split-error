// The correct cube action, worked out from Galaxy's own cube equities
// rather than read from its `doublers_best_action`/`receivers_best_action`
// labels — on about 18k counted old-analysis cube decisions those labels
// are stuck at "roll" while `raw_error` (the grade) follows the equities
// (e.g. decision 629849: ND 0.7922, DT 0.9751, labelled "roll", but not
// doubling is graded BLUNDER −0.183). Display-only: rawError/severity stay
// Galaxy's, and the stored cubeActionBest column keeps Galaxy's own label.
// See docs/field-mapping.md, "Cube action from the equities".
//
// The rule, from the doubler's side (ND = no_double, DT = double_take,
// DP = double_pass):
//   ND <  DP, DT <= DP: Double/take if DT > ND, otherwise No double/take
//   ND <  DP, DT >  DP: Double/pass
//   ND >= DP, DT >  DP: Too good/pass
//   ND >= DP, DT <= DP: Too good/take
// Ties: DT == ND -> No double/take; ND == DP -> too good; DT == DP -> take.
// DP is 1 on every counted cube_double row (it's 0.18–0.91 on 89,593
// uncounted pre-roll checks locally), but the rule compares against DP rather than a literal
// 1 so it stays right if that ever changes.
//
// Comparison with Galaxy: a disagreement caused only by an exact tie counts
// as matching (about 324 counted rows locally) — ND == min(DT, DP) (not
// doubling equals what doubling yields: "roll" and "double" both match on
// the doubling part; i.e. ND == DP with DT >= DP, or DT == ND below DP),
// DT == DP (take and pass are equal: both match). The derived action itself
// keeps the tie rules above; only matchesGalaxy changes. Exact equality on
// the stored numbers, as the tie rules use.
import type { CubeAnalysis, Review } from "@/lib/gameReviewsTypes";

export type DoublerAction =
  | "No double/take"
  | "Double/take"
  | "Double/pass"
  | "Too good/take"
  | "Too good/pass";
export type ReceiverAction = "Take" | "Pass";
export type CubeAction = DoublerAction | ReceiverAction;

export interface CubeActionResult {
  action: CubeAction;
  // Whether Galaxy's own best-action label(s) agree with `action`.
  matchesGalaxy: boolean;
  // Galaxy's own label, as stored (underscores as spaces), e.g. "roll" or
  // "double, pass".
  galaxyLabel: string;
}

type Equities = Pick<CubeAnalysis, "no_double" | "double_take" | "double_pass">;

// Doubler-view equities -> one of the five actions. All three in the
// doubler's own view (as stored on cube_double rows).
export function doublerAction(nd: number, dt: number, dp: number): DoublerAction {
  const take = dt <= dp;
  if (nd >= dp) return take ? "Too good/take" : "Too good/pass";
  if (!take) return "Double/pass";
  return dt > nd ? "Double/take" : "No double/take";
}

// The receiver's answer to a double: take if the doubler-view DT <= DP.
export function receiverAction(dt: number, dp: number): ReceiverAction {
  return dt <= dp ? "Take" : "Pass";
}

const TAKE_SIDE = new Set<CubeAction>(["No double/take", "Double/take", "Too good/take", "Take"]);
const DOUBLE_SIDE = new Set<CubeAction>(["Double/take", "Double/pass"]);

function format(label: string | null | undefined): string | null {
  return typeof label === "string" && label !== "" ? label.replace(/_/g, " ") : null;
}

// Galaxy's receiver label ("take"/"pass") agrees with `action`'s take side,
// or either label goes when take and pass are tied (DT == DP).
function receiverMatches(action: CubeAction, receiverLabel: string, takePassTie: boolean): boolean {
  if (receiverLabel === "take") return takePassTie || TAKE_SIDE.has(action);
  if (receiverLabel === "pass") return takePassTie || !TAKE_SIDE.has(action);
  return false;
}

// Galaxy's doubler label ("roll"/"no double" or "double") agrees with
// `action`'s doubling side, or either label goes when doubling and not
// doubling are tied (ND == DP, or DT == ND below DP).
function doublerMatches(action: DoublerAction, doublerLabel: string | null, doubleTie: boolean): boolean {
  if (doublerLabel === "roll" || doublerLabel === "no double") return doubleTie || !DOUBLE_SIDE.has(action);
  if (doublerLabel === "double") return doubleTie || DOUBLE_SIDE.has(action);
  return false;
}

function isNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

// The derived action for a cube decision, or null when the equities are
// missing (then callers fall back to Galaxy's own label).
//
// cube_double rows hold the doubler's view. cube_pass rows hold the
// receiver's view, i.e. the doubler's values negated (DP = −1); a handful
// (4 locally, all in matches 33002925/33013316) aren't negated (DP = +1).
// Multiplying by the sign of DP brings both back to the doubler's view, so
// "take if −DT <= −DP" on a negated row is the same test as DT <= DP here.
export function deriveCubeAction(
  analysedEvent: string,
  cube: Partial<Equities> & Partial<Pick<CubeAnalysis, "doublers_best_action" | "receivers_best_action">>
): CubeActionResult | null {
  const { no_double: nd, double_take: dt, double_pass: dp } = cube;
  if (!isNum(nd) || !isNum(dt) || !isNum(dp) || dp === 0) return null;
  const doublerLabel = format(cube.doublers_best_action);
  const receiverLabel = format(cube.receivers_best_action);

  if (analysedEvent === "cube_double") {
    const action = doublerAction(nd, dt, dp);
    // Galaxy's stored labels are "roll"/"double"; "no double" is accepted
    // as the no-double side too.
    // Doubling ties not doubling only when ND equals what doubling yields,
    // min(DT, DP). That covers ND == DP when DT >= DP, and DT == ND below
    // DP. Not DT < DP == ND: doubling yields DT < ND there.
    const doubleTie = nd === Math.min(dt, dp);
    let matches = doublerMatches(action, doublerLabel, doubleTie);
    if (receiverLabel !== null) matches = matches && receiverMatches(action, receiverLabel, dt === dp);
    const galaxyLabel = [doublerLabel, receiverLabel].filter((l) => l !== null).join(", ");
    return { action, matchesGalaxy: matches, galaxyLabel };
  }

  if (analysedEvent === "cube_pass") {
    const sign = Math.sign(dp);
    const action = receiverAction(dt * sign, dp * sign);
    return {
      action,
      matchesGalaxy: receiverLabel !== null && receiverMatches(action, receiverLabel, dt === dp),
      galaxyLabel: receiverLabel ?? "",
    };
  }

  return null;
}

// The derived action for a review, if it's a cube review with equities.
export function deriveCubeActionFromReview(review: Review): CubeActionResult | null {
  const envelope = review.result;
  if (envelope.analysed_event !== "cube_double" && envelope.analysed_event !== "cube_pass") return null;
  const cube = envelope.result.cube_analysis;
  if (!cube) return null;
  return deriveCubeAction(envelope.analysed_event, cube);
}
