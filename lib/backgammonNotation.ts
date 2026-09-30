// Parser for Galaxy/GNU-style checker-move notation strings, e.g.
// "24/23 13/9", "13/9(2)", "bar/22", "5/off", "9/4*".

export interface ParsedSubMove {
  from: number | "bar";
  to: number | "off";
  hit: boolean;
  count: number;
}

const TOKEN_RE = /^(bar|off|\d{1,2})\/(bar|off|\d{1,2})(\*)?(?:\((\d+)\))?$/i;

function parsePoint(raw: string): number | "bar" | "off" {
  const lower = raw.toLowerCase();
  if (lower === "bar") return "bar";
  if (lower === "off") return "off";
  return Number(raw);
}

// For a fixed-perspective board flip (see lib/gnuPositionId.ts's
// flipPerspective): a parsed sub-move's from/to point numbers are already
// expressed in the same on-roll-mover's frame as DecodedPosition's own
// mine/opponent arrays (point N means the same physical square in both),
// so a flip needs the identical point <-> 25-point mirror applied here too,
// or an arrow would land on the wrong square relative to the now-flipped
// checkers. "bar"/"off" are untouched — they resolve correctly on their own
// once the underlying bar/off counts are swapped by flipPerspective, since
// neither one is a numbered physical point to begin with.
export function mirrorSubMoves(subMoves: ParsedSubMove[]): ParsedSubMove[] {
  return subMoves.map((move) => ({
    ...move,
    from: move.from === "bar" ? "bar" : 25 - move.from,
    to: move.to === "off" ? "off" : 25 - move.to,
  }));
}

export function parseNotation(notation: string): ParsedSubMove[] {
  const tokens = notation.trim().split(/\s+/).filter(Boolean);
  const subMoves: ParsedSubMove[] = [];

  for (const token of tokens) {
    const match = token.match(TOKEN_RE);
    if (!match) continue;

    const [, rawFrom, rawTo, hitMarker, countMarker] = match;
    const from = parsePoint(rawFrom);
    const to = parsePoint(rawTo);

    if (from === "off" || to === "bar") continue;

    subMoves.push({
      from,
      to,
      hit: Boolean(hitMarker),
      count: countMarker ? Number(countMarker) : 1,
    });
  }

  return subMoves;
}
