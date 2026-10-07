// Galaxy's translator for Decision.analysis (lib/analysis/types.ts): turns a
// stored Galaxy event (`Decision.raw`) into the source-neutral shape. Pure —
// no DB, no network. Used by lib/ingest.ts (new rows) and
// scripts/backfill-decision-analysis.ts (existing rows), so both fill the
// column the same way. See docs/field-mapping.md, "Decision.analysis".
//
// Reads only:
//   reviews[0].result.result.moves[]         (move rows)
//     .notation, .rank, .equity, .move_played,
//     .probabilities.{win, win_gammon, win_backgammon, lose_gammon, lose_backgammon}
//   reviews[0].result.result.cube_analysis   (cube_double / cube_pass rows)
//     .no_double, .double_take, .double_pass
//
// Checker: candidates are sorted by equity, best first, with exact ties
// broken by Galaxy's rank. Galaxy's own rank isn't always in equity order
// (148 local cases where a lower rank has higher equity), and its
// decision-level raw_error can disagree with the candidates (124 old cases,
// e.g. 33015498 g7, where the played rank-1 move is 0.309 worse than
// rank 2), so the shape is built from the candidates' own equities only.
// `loss` is recomputed from those equities, not read from equity_error.
//
// Cube: the equities are stored in the doubler's view, sign-normalized once
// here by lib/cubeAction.ts's doublerViewEquities (the same rule the cube
// action display uses).
//
// Resignations and anything unrecognised (unknown analysed_event, missing or
// malformed candidates/equities, not exactly one played candidate) -> null.
import { doublerViewEquities } from "@/lib/cubeAction";
import type { CandidateProbs, CheckerCandidate, DecisionAnalysis } from "@/lib/analysis/types";

// 4 decimals: Galaxy's own precision, and keeps the JSON compact.
function round4(x: number): number {
  const r = Math.round(x * 1e4) / 1e4;
  return r === 0 ? 0 : r; // no -0 in the JSON
}

function isNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// raw.reviews[0].result.result, or null if any step is missing.
function analysisResult(raw: unknown): Record<string, unknown> | null {
  if (!isObject(raw) || !Array.isArray(raw.reviews)) return null;
  const review = raw.reviews[0];
  if (!isObject(review) || !isObject(review.result)) return null;
  const result = review.result.result;
  return isObject(result) ? result : null;
}

function candidateProbs(p: unknown): CandidateProbs | null {
  if (!isObject(p)) return null;
  const { win, win_gammon, win_backgammon, lose_gammon, lose_backgammon } = p;
  if (!isNum(win) || !isNum(win_gammon) || !isNum(win_backgammon) || !isNum(lose_gammon) || !isNum(lose_backgammon)) {
    return null;
  }
  return {
    win: round4(win),
    winG: round4(win_gammon),
    winBG: round4(win_backgammon),
    loseG: round4(lose_gammon),
    loseBG: round4(lose_backgammon),
  };
}

function checkerAnalysis(moves: unknown): DecisionAnalysis | null {
  if (!Array.isArray(moves) || moves.length === 0) return null;

  const parsed: { move: string; rank: number; equity: number; played: boolean; probs: CandidateProbs | null }[] = [];
  for (const m of moves) {
    if (!isObject(m)) return null;
    const { notation, rank, equity, move_played } = m;
    if (typeof notation !== "string" || !isNum(rank) || !isNum(equity) || typeof move_played !== "boolean") {
      return null;
    }
    parsed.push({ move: notation, rank, equity, played: move_played, probs: candidateProbs(m.probabilities) });
  }
  if (parsed.filter((c) => c.played).length !== 1) return null;

  parsed.sort((a, b) => b.equity - a.equity || a.rank - b.rank);
  // loss from the rounded equities, so the stored numbers agree exactly
  // (Galaxy's equities are already 4 decimals, so this changes nothing there).
  const best = round4(parsed[0].equity);
  const candidates: CheckerCandidate[] = parsed.map((c) => ({
    move: c.move,
    rank: c.rank,
    equity: round4(c.equity),
    loss: round4(round4(c.equity) - best),
    played: c.played,
    probs: c.probs,
  }));
  return { v: 1, source: "galaxy", kind: "checker", candidates };
}

function cubeAnalysis(analysedEvent: "cube_double" | "cube_pass", cube: unknown): DecisionAnalysis | null {
  if (!isObject(cube)) return null;
  const view = doublerViewEquities(analysedEvent, cube);
  if (!view) return null;
  return {
    v: 1,
    source: "galaxy",
    kind: "cube",
    role: analysedEvent === "cube_double" ? "doubler" : "receiver",
    nd: round4(view.nd),
    dt: round4(view.dt),
    dp: round4(view.dp),
  };
}

// `raw` is the stored Galaxy event (Decision.raw); `analysedEvent` is its
// reviews[0].result.analysed_event (Decision.analysedEvent).
export function galaxyAnalysis(raw: unknown, analysedEvent: string): DecisionAnalysis | null {
  const result = analysisResult(raw);
  if (!result) return null;
  if (analysedEvent === "move") return checkerAnalysis(result.moves);
  if (analysedEvent === "cube_double" || analysedEvent === "cube_pass") {
    return cubeAnalysis(analysedEvent, result.cube_analysis);
  }
  return null;
}
