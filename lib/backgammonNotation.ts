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
