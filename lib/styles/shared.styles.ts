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

  // A centred confirmation dialog over a dimmed page — /mistakes' "Add all
  // to review" and /review/cards' delete confirmation (same look as
  // /galaxy/matches' TokenModal, which keeps its own copy).
  modalOverlay: "fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-6",
  modalPanel:
    "flex w-full max-w-lg flex-col gap-4 rounded-xl border border-black/10 bg-white p-6 shadow-xl dark:border-white/15 dark:bg-zinc-900",
  modalHeading: "text-lg font-semibold text-black dark:text-zinc-50",
  modalText: "text-sm text-zinc-700 dark:text-zinc-300",
  modalError: "text-sm text-red-600 dark:text-red-400",
  modalButtons: "flex justify-end gap-2",
  modalPrimaryButton:
    "rounded-full bg-black px-4 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-black dark:hover:bg-zinc-200",
  modalSecondaryButton:
    "rounded-full border border-black/10 px-4 py-1.5 text-sm font-medium text-black hover:bg-zinc-100 dark:border-white/15 dark:text-zinc-100 dark:hover:bg-zinc-800",
} as const;
