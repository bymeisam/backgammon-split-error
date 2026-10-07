// How BoardPanel frames a decision's board: whether the decoded position
// (and its cube) is flipped, and where the cube is drawn. Pure, so it's
// unit-tested without rendering BoardPanel.
import type { Decision } from "@/lib/mistakes";
import type { CubeOwner, Side } from "@/lib/boardGeometry";
import { flipCubeState } from "@/lib/cubeState";

// Whether BoardPanel flips a decision's decoded position and cube before
// drawing it. Two independent reasons, which cancel when both hold:
// - `viewFlipped`: the replay's fixed-perspective view, when the decision
//   on screen is the opponent's;
// - `decision.positionFromOpponent`: the stored position is drawn from the
//   other player's side (a take/pass, stored from the doubler's side —
//   see lib/cubeState.ts's positionFromOpponent).
// With neither, the decision-maker is at the bottom, as on every view.
export function boardPositionFlipped(
  decision: Pick<Decision, "positionFromOpponent"> | null,
  viewFlipped: boolean | undefined
): boolean {
  return Boolean(viewFlipped) !== Boolean(decision?.positionFromOpponent);
}

// The cube as the board draws it:
// - "owned": the cube entering the decision, beside its owner in the left
//   gutter (or centred) — every decision except a take/pass;
// - "offered": on a take/pass, the value being offered (twice the current
//   cube), centred on the receiver's edge, as Galaxy draws it (since
//   2026-10-07; before that the current value on the doubler's side).
export type BoardCube =
  | { kind: "owned"; value: number; owner: CubeOwner }
  | { kind: "offered"; value: number; side: Side };

export function boardCubeFor(
  decision: Pick<Decision, "cubeState" | "doubleOffer" | "positionFromOpponent"> | null,
  viewFlipped: boolean | undefined
): BoardCube | null {
  if (!decision) return null;
  if (decision.doubleOffer) {
    // The receiver is the decision-maker, so at the bottom — unless the
    // replay's fixed perspective is showing the opponent's take/pass.
    return { kind: "offered", value: decision.doubleOffer.value, side: viewFlipped ? "opponent" : "mine" };
  }
  const state = decision.cubeState;
  // No Match ID (no state) or not confident -> draw nothing rather than a
  // guess (lib/cubeState.ts).
  if (!state || !state.confident) return null;
  const drawn = boardPositionFlipped(decision, viewFlipped) ? flipCubeState(state) : state;
  return { kind: "owned", value: drawn.value, owner: drawn.owner };
}
