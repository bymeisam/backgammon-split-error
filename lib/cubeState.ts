// The doubling cube as the board draws it. Read straight from each
// decision's own GNU Match ID (reviews[0].source_match.formatted_value, see
// lib/gnuMatchId.ts) — the earlier walk over a game's take events
// (computeCubeStates) missed takes on about 22% of rows and was retired on
// 2026-10-06; see docs/field-mapping.md, "GNU Match ID".
import type { CubeOwner } from "@/lib/boardGeometry";
import type { DecodedMatchId, GnuPlayer } from "@/lib/gnuMatchId";

export interface CubeState {
  value: number; // 1 = centered/undoubled, then 2, 4, 8, ...
  // Relative to the on-roll player of the decision's stored position ID
  // (GNU's dice owner), which is not always the decision's actor: on a
  // take/pass the stored position is the doubler's. BoardPanel flips the
  // position and this cube together for those rows (see
  // positionFromOpponent below), so the receiver ends up at the bottom and
  // the cube stays beside its real owner's checkers.
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

// Whether a decision's stored position is drawn from the OTHER player's
// side rather than the actor's. True on a take/pass (cube_pass): the
// position ID is the doubler's (the Match ID's dice owner) while the actor
// is the receiver (the Match ID's turn) — 6,997 of 6,999 local cube_pass
// rows share the preceding cube_double row's position ID. BoardPanel flips
// those boards so the decision-maker is at the bottom, as on every other
// decision and as Galaxy's own site draws a take. Read from the Match ID
// (dice owner != turn) when it decodes; without one, cube_pass alone.
export function positionFromOpponent(analysedEvent: string, m: DecodedMatchId | null): boolean {
  if (analysedEvent !== "cube_pass") return false;
  return m ? m.diceOwner !== m.turn : true;
}

// The double a take/pass answers. Galaxy doesn't analyse the doubler's
// offer when only the receiver had a decision, so the replay labels the
// take/pass step with it instead. Offered value = twice the cube entering
// the decision; a redouble when the cube was already owned.
export interface DoubleOffer {
  value: number;
  redouble: boolean;
  // review.take: true = took, false = passed, null = not recorded.
  took: boolean | null;
}

export function doubleOfferFor(
  analysedEvent: string,
  m: DecodedMatchId | null,
  take: boolean | null | undefined
): DoubleOffer | null {
  if (analysedEvent !== "cube_pass" || !m) return null;
  return { value: m.cubeValue * 2, redouble: m.cubeOwner !== null, took: take ?? null };
}

// One short line for a take/pass step, from the user's side when known
// ("Opponent redoubles to 4: you took", "You double to 2: opponent
// passed"), else by colour ("Black doubles to 2: White took").
// `actorIsMe` is whether the receiver (the decision's actor) is the user.
export function doubleOfferLabel(
  offer: DoubleOffer,
  actorIsMe: boolean | null,
  actorColor: string
): string {
  const verb = offer.redouble ? "redouble" : "double";
  const response = offer.took === null ? null : offer.took ? "took" : "passed";
  let doubler: string;
  let receiver: string;
  let doublerVerb: string;
  if (actorIsMe === null) {
    const other = actorColor === "black" ? "white" : actorColor === "white" ? "black" : "";
    doubler = other ? capitalize(other) : "Opponent";
    receiver = actorColor ? capitalize(actorColor) : "receiver";
    doublerVerb = `${verb}s`;
  } else if (actorIsMe) {
    doubler = "Opponent";
    receiver = "you";
    doublerVerb = `${verb}s`;
  } else {
    doubler = "You";
    receiver = "opponent";
    doublerVerb = verb;
  }
  const offerText = `${doubler} ${doublerVerb} to ${offer.value}`;
  return response ? `${offerText}: ${receiver} ${response}` : offerText;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
