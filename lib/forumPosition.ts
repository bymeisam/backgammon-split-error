import {
  crawfordStateFor,
  decodeGnuMatchId,
  diceRollFor,
  effectiveMatchLength,
  type DecodedMatchId,
} from "@/lib/gnuMatchId";
import { decodeGnuPositionId, type DecodedPosition } from "@/lib/gnuPositionId";
import type { BoardCube } from "@/lib/boardFrame";

export type ForumPositionKind = "CHECKER" | "CUBE";

// One forum attachment decoded for drawing: the board, its cube and (for a
// checker position) the roll to play. Shared by the post page
// (app/forum/[id]) and the new-post preview (app/forum/new). Plain data, so
// a server page can pass it to a client component.
export type DecodedForumPosition = {
  position: DecodedPosition;
  match: DecodedMatchId;
  cube: BoardCube;
  dice: number[];
};

// Decodes a GNU Position ID and GNU Match ID pair, or null if either is
// invalid. The IDs are from the point of view of the player on roll
// (diceOwner), which the board draws as "mine".
export function decodeForumPosition(
  positionId: string,
  gnuMatchId: string,
  kind: ForumPositionKind,
): DecodedForumPosition | null {
  let position: DecodedPosition;
  try {
    position = decodeGnuPositionId(positionId);
  } catch {
    return null;
  }
  const match = decodeGnuMatchId(gnuMatchId);
  if (!match) return null;
  const owner = match.cubeOwner === null ? "center" : match.cubeOwner === match.diceOwner ? "mine" : "opponent";
  return {
    position,
    match,
    cube: { kind: "owned", value: match.cubeValue, owner },
    dice: diceRollFor(kind === "CHECKER" ? "move" : null, match),
  };
}

// The caption of an attached position, after "Position n":
// "5-point match · 3–2 · Crawford · 6-4 to play", or "Money game · Cube
// decision". The score is the player on roll's first (score is indexed
// white/black; diceOwner is the player on roll). Crawford wording follows
// lib/review/format.ts formatMatchContext.
export function forumPositionCaption(match: DecodedMatchId, kind: ForumPositionKind): string {
  const length = effectiveMatchLength(match);
  const parts: string[] = [];
  if (length === 0) {
    parts.push("Money game");
  } else {
    parts.push(`${length}-point match`);
    const onRoll = match.diceOwner;
    parts.push(`${match.score[onRoll]}–${match.score[onRoll === 0 ? 1 : 0]}`);
    const crawford = crawfordStateFor(match);
    if (crawford === "crawford") parts.push("Crawford");
    if (crawford === "post_crawford") parts.push("post-Crawford");
  }
  if (kind === "CUBE") {
    parts.push("Cube decision");
  } else {
    const dice = diceRollFor("move", match);
    parts.push(dice.length === 2 ? `${dice[0]}-${dice[1]} to play` : "Checker play");
  }
  return parts.join(" · ");
}
