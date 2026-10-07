// Parser for Galaxy/GNU-style checker-move notation strings, e.g.
// "24/23 13/9", "13/9(2)", "bar/22", "5/off", "9/4*".

export interface ParsedSubMove {
  from: number | "bar";
  to: number | "off";
  hit: boolean;
  count: number;
}

// A token is one checker's whole move for this roll: a chain of 2+ points
// (bar/off/a 1-2 digit point number) joined by "/", each hop after the
// first optionally hit-marked ("*"), the whole token optionally suffixed
// with a (count) meaning that many checkers made this exact chain. The
// simple "13/9*" case is just a 1-hop chain — CHAIN_RE handles both
// shapes uniformly, there's no separate single-move regex.
const POINT = "(?:bar|off|\\d{1,2})";
const CHAIN_RE = new RegExp(`^(${POINT})((?:/${POINT}\\*?)+)(?:\\((\\d+)\\))?$`, "i");
// Pulls one "/point(*)?" hop at a time out of CHAIN_RE's own chain-rest
// capture group — reused rather than re-splitting that string by hand.
const HOP_RE = /\/(bar|off|\d{1,2})(\*)?/gi;

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

// Chained compact notation (e.g. "13/10*/6", a single checker's two
// sequential sub-moves written as one slash chain) used to match CHAIN_RE's
// own anchored single-hop case but fail the regex entirely once a second
// "/" appeared — silently dropping the whole token, no arrow drawn for
// either hop. Confirmed against real data: ~1.55% of CHECKER decisions
// have at least one chained token in the played and/or best move (then
// the movePlayed/moveBest columns, since dropped — read from raw now),
// almost all 2-hop but real 3- and 4-hop examples exist too (PROGRESS.md,
// 2026-10-01) — so this walks the chain generically rather than special-
// casing 2 hops. Each hop becomes its own ParsedSubMove (its own anchor,
// its own independent hit flag — "bar/21*/18*" hits at both 21 and 18), so
// Board.tsx's arrow rendering and mirrorSubMoves need no changes: both
// already operate on a flat ParsedSubMove[], just a fuller one now.
export function parseNotation(notation: string): ParsedSubMove[] {
  const tokens = notation.trim().split(/\s+/).filter(Boolean);
  const subMoves: ParsedSubMove[] = [];

  for (const token of tokens) {
    const match = token.match(CHAIN_RE);
    if (!match) continue;

    const [, rawFirst, chainRest, countMarker] = match;
    const count = countMarker ? Number(countMarker) : 1;

    const points: (number | "bar" | "off")[] = [parsePoint(rawFirst)];
    const hits: boolean[] = [];
    for (const hop of chainRest.matchAll(HOP_RE)) {
      points.push(parsePoint(hop[1]));
      hits.push(Boolean(hop[2]));
    }

    // A (count) suffix on a chain means that many checkers each made the
    // *whole* chain (e.g. "5/4*/3(2)": two checkers, each 5/4*/3) — applied
    // to every resulting hop, not just the last one. This keeps the same
    // "one ParsedSubMove, a count field" representation a plain repeated
    // move already uses (e.g. "13/7(3)"), rather than emitting duplicate
    // hop entries — Board.tsx already draws one "×N" label per subMove, so
    // a 2-hop chain with count 2 draws two arrows, each labeled "×2", the
    // direct generalization of the existing single-hop behavior.
    for (let i = 0; i < points.length - 1; i++) {
      const from = points[i];
      const to = points[i + 1];
      if (from === "off" || to === "bar") continue;
      subMoves.push({ from, to, hit: hits[i], count });
    }
  }

  return subMoves;
}
