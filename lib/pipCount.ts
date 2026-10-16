// Pip counts for a DecodedPosition (lib/gnuPositionId.ts). Both arrays are
// indexed in `mine`'s frame: index i is point i+1 counted from `mine`'s ace
// point. `mine` moves towards point 1, so a checker on point p is p pips from
// home; `opponent` moves the other way, so its checker on `mine`'s point p is
// on its own point 25 - p. A checker on the bar is 25 pips away; borne-off
// checkers count 0.

import type { DecodedPosition } from "./gnuPositionId";

export const BAR_PIPS = 25;

export function pipCounts(position: DecodedPosition): { mine: number; opponent: number } {
  let mine = position.mineBar * BAR_PIPS;
  let opponent = position.opponentBar * BAR_PIPS;
  for (let point = 1; point <= 24; point++) {
    mine += position.mine[point - 1] * point;
    opponent += position.opponent[point - 1] * (25 - point);
  }
  return { mine, opponent };
}
