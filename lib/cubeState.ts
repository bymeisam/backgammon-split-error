// Cumulative doubling-cube state across a game, computed by walking its
// events in order — the cube's value/owner at any one decision depends on
// every prior cube action, so (unlike decoded positions or notation) it
// can't be derived from a single Decision row in isolation.
import type { GameEvent } from "@/lib/gameReviewsTypes";
import type { CubeOwner } from "@/lib/boardGeometry";

export interface CubeState {
  value: number; // 1 = centered/undoubled, then 2, 4, 8, ...
  // Relative to the EVENT's own actor (event.user_id) — same "mine"
  // framing decoded positions already use, so this composes with
  // BoardPanel's existing mine/opponent handling without a second
  // relativization step.
  owner: CubeOwner;
  // False once a structural inconsistency is detected in the walked event
  // sequence (see computeCubeStates below) — this decision and every later
  // one in the game can no longer be trusted. Consumers should render
  // nothing rather than a possibly-wrong number when this is false; never
  // show a guess as if it were certain.
  confident: boolean;
}

// Walks one game's events in eventId order, returning the cube's state
// entering each decision — before that decision's own outcome is applied,
// the same timing as `source_position` and lib/ingest.ts's own
// cubeOwnerUserId comment ("owner entering this decision, before applying
// its own outcome"). Standard backgammon convention (confirmed against
// lib/ingest.ts's own cubeOwnerUserId semantics, not the literal "doubler's
// side" phrasing a first read suggests): the cube moves to the TAKER's
// side after an accepted double, since only the taker may redouble next.
//
// Incomplete-data handling: neither Game/Match/SyncRun has any per-game
// "ingest completed" marker, and game_over events never become Decision
// rows at all (lib/ingest.ts's NON_DECISION_EVENT_TYPES) — so there's no
// "did we get everything" signal to check against. Instead this leans on
// the game's own legality: a cube_double can only legally be followed by
// its own cube_pass — nothing else can happen while a double is
// unresolved. Anything else observed while one is pending (a checker/
// resignation decision, a second double, or a pass with nothing pending)
// is a structural impossibility in complete, valid data, and permanently
// flips `confident` to false for the rest of the game. This catches a
// genuine mid-sequence gap (e.g. a dropped cube_pass row from a partial
// sync) — not just a double left unresolved at the very end of the
// fetched array, which is harmless on its own since there's nothing after
// it to get wrong.
export function computeCubeStates(events: GameEvent[]): Map<number, CubeState> {
  const states = new Map<number, CubeState>();

  let value = 1;
  let absoluteOwnerUserId: string | null = null; // null = center/undoubled
  let pendingDoubleUnresolved = false;
  let confident = true;

  for (const event of events) {
    const review = event.reviews?.[0];
    // No review at all (game_started/game_over/turn_forfeited, per
    // lib/ingest.ts's NON_DECISION_EVENT_TYPES) — not a decision, doesn't
    // participate in the walk and never becomes a Decision row to look
    // this up for.
    if (!review) continue;

    const analysedEvent = review.result.analysed_event;
    const isCubeDouble = analysedEvent === "cube_double";
    const isCubePass = analysedEvent === "cube_pass";

    if (pendingDoubleUnresolved ? !isCubePass : isCubePass) {
      confident = false;
    }

    // Snapshot BEFORE applying this event's own outcome.
    const owner: CubeOwner =
      absoluteOwnerUserId === null ? "center" : absoluteOwnerUserId === event.user_id ? "mine" : "opponent";
    states.set(event.id, { value, owner, confident });

    if (isCubeDouble && review.double === true) {
      pendingDoubleUnresolved = true;
    } else if (isCubePass) {
      if (review.take === true) {
        value *= 2;
        absoluteOwnerUserId = event.user_id;
      }
      pendingDoubleUnresolved = false;
    }
  }

  return states;
}

// Mirrors flipPerspective/mirrorSubMoves: swaps mine<->opponent, leaves
// "center"/value/confident untouched. Applied once in BoardPanel.tsx
// alongside the other two flip transforms.
export function flipCubeState(state: CubeState): CubeState {
  if (state.owner === "center") return state;
  return { ...state, owner: state.owner === "mine" ? "opponent" : "mine" };
}
