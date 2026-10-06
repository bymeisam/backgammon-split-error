// Whether BoardPanel flips a decision's decoded position and cube before
// drawing it. Two independent reasons, which cancel when both hold:
// - `viewFlipped`: the replay's fixed-perspective view, when the decision
//   on screen is the opponent's;
// - `decision.positionFromOpponent`: the stored position is drawn from the
//   other player's side (a take/pass, stored from the doubler's side —
//   see lib/cubeState.ts's positionFromOpponent).
// With neither, the decision-maker is at the bottom, as on every view.
// Pure, so it's unit-tested without rendering BoardPanel.
import type { Decision } from "@/lib/mistakes";

export function boardPositionFlipped(
  decision: Pick<Decision, "positionFromOpponent"> | null,
  viewFlipped: boolean | undefined
): boolean {
  return Boolean(viewFlipped) !== Boolean(decision?.positionFromOpponent);
}
