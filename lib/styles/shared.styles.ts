// Cross-cutting style values (see .claude/skills/styling-conventions) —
// used by otherwise-unrelated call sites.
//
// Galaxy's own severity colours (reports/2026-10-07-galaxy-client-
// comparison.md): Best green #36D399, Good slate #65758B, Error amber
// #FBBD23, Blunder red #F43E5C, and blue #2C44FF for a cube square that
// isn't an error or blunder. Used by the severity badges (lib/badges.ts ->
// Badge) and the cube square in the decision lists (DecisionList). Drawn as
// filled chips, so they read the same on the light and dark page
// backgrounds; the text colour on each is whichever of near-black/white
// contrasts more with that fill (dark on green, amber and red — red with
// white text is only ~3.7:1 — white on slate and blue).
export const style = {
  severityBest: "border-[#36D399] bg-[#36D399] text-zinc-950",
  severityGood: "border-[#65758B] bg-[#65758B] text-white",
  severityError: "border-[#FBBD23] bg-[#FBBD23] text-zinc-950",
  severityBlunder: "border-[#F43E5C] bg-[#F43E5C] text-zinc-950",
  cubeSquareDefault: "border-[#2C44FF] bg-[#2C44FF] text-white",
} as const;
