// The doubling cube as the board draws it. Read straight from each
// decision's own GNU Match ID (reviews[0].source_match.formatted_value, see
// lib/gnuMatchId.ts) — the earlier walk over a game's take events
// (computeCubeStates) missed takes on about 22% of rows and was retired on
// 2026-10-06; see docs/field-mapping.md, "GNU Match ID".
import type { CubeOwner } from "@/lib/boardGeometry";
import type { DecodedMatchId, GnuPlayer } from "@/lib/gnuMatchId";

export interface CubeState {
  value: number; // 1 = centered/undoubled, then 2, 4, 8, ...
  // Relative to the player drawn at the BOTTOM of the board — the player on
  // roll in the decision's position ID (GNU's dice owner), which is not
  // always the decision's actor: on a take/pass the stored position is the
  // doubler's, so the receiver is drawn at the top. Relativizing to the
  // board's own bottom player keeps the cube beside its real owner's
  // checkers.
  owner: CubeOwner;
  // Kept for Board's "draw nothing rather than a guess" gate. Always true
  // for a state built from a decodable Match ID; DB rows whose Match ID
  // didn't decode carry cubeConfident = false and get no CubeState at all.
  confident: boolean;
}

// Which side of the board `owner` sits on, given who's drawn at the bottom.
export function cubeSide(owner: GnuPlayer | null, bottomPlayer: GnuPlayer): CubeOwner {
  if (owner === null) return "center";
  return owner === bottomPlayer ? "mine" : "opponent";
}

// The full board cube state for one decision, from its own Match ID.
export function cubeStateFromMatchId(m: DecodedMatchId | null): CubeState | null {
  if (!m) return null;
  return { value: m.cubeValue, owner: cubeSide(m.cubeOwner, m.diceOwner), confident: true };
}

// Mirrors flipPerspective/mirrorSubMoves: swaps mine<->opponent, leaves
// "center"/value/confident untouched. Applied once in BoardPanel.tsx
// alongside the other two flip transforms.
export function flipCubeState(state: CubeState): CubeState {
  if (state.owner === "center") return state;
  return { ...state, owner: state.owner === "mine" ? "opponent" : "mine" };
}
