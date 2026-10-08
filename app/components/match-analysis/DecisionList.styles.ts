import clsx from "clsx";
import type { SeverityTier } from "@/lib/badges";
import type { Severity } from "@/lib/mistakes";
import { style as shared } from "@/lib/styles/shared.styles";

// Which leading columns a list has (DecisionList's `columns`).
export type ListColumns = "replay" | "match" | "plain";

// Shared by GameReplay's list, MistakesSection's two lists and
// DecisionListWithDetail's list: one card per list, a row per decision.
export const style = {
  // Function, 1 param (options object) -> the list card. `sticky`: beside
  // the board from 980px up, scrolling inside itself; `bleed`: square and
  // edge to edge below md.
  card: (opts: { sticky: boolean; bleed: boolean }): string =>
    clsx(
      shared.card,
      "flex min-h-0 min-w-0 flex-col overflow-hidden",
      opts.sticky && "min-[980px]:sticky min-[980px]:top-[76px] min-[980px]:max-h-[calc(100vh-96px)]",
      opts.bleed && "max-md:rounded-none max-md:border-x-0"
    ),
  head: "flex items-center justify-between gap-3 border-b border-line px-4 pb-2.5 pt-3.5",
  title: shared.overline,
  legend: "flex gap-2.5 text-[11.5px] text-ink-faint",
  legendItem: "inline-flex items-center",
  // Function, 1 param -> passed directly. A legend square in the tier's fill.
  legendSwatch: (tier: SeverityTier): string =>
    clsx(
      "mr-1 inline-block h-[7px] w-[7px] rounded-[2px]",
      tier === "good" && "bg-good",
      tier === "error" && "bg-error",
      tier === "blunder" && "bg-blunder"
    ),
  emptyText: "px-4 py-3.5 text-sm text-ink-muted",
  scroll: "min-h-0 overflow-y-auto",
  table: "block w-full border-collapse text-left",
  body: "block",

  // Function, 1 param (options object). Focusable (Enter/Space selects);
  // the selected row has an accent bar on the left and an accent wash.
  row: (opts: { isSelected: boolean; columns: ListColumns }): string =>
    clsx(
      "grid cursor-pointer items-center gap-2 border-b border-l-[3px] border-b-line py-2 pl-3.5 pr-4 last:border-b-0",
      opts.columns === "replay" && "grid-cols-[28px_44px_minmax(0,1fr)_auto]",
      opts.columns === "match" && "grid-cols-[20px_44px_minmax(0,1fr)_auto]",
      opts.columns === "plain" && "grid-cols-[minmax(0,1fr)_auto]",
      shared.focusRingInset,
      opts.isSelected
        ? "border-l-accent bg-[color-mix(in_srgb,var(--color-accent)_9%,var(--color-surface))]"
        : "border-l-transparent hover:bg-sunken"
    ),
  checkboxCell: "flex items-center",
  // Function, 1 param -> passed directly. ink-muted on the selected row:
  // ink-faint is 4.3:1 on its wash, under 4.5.
  indexCell: (isSelected: boolean): string =>
    clsx("text-right font-mono text-xs tabular-nums", isSelected ? "text-ink-muted" : "text-ink-faint"),
  diceCell: "flex gap-[3px]",
  moveCell: "flex min-w-0 items-baseline",
  trailingCell: "flex items-center justify-end gap-1.5 whitespace-nowrap",
  // The loss in a row's right-hand cell.
  loss: "font-mono text-xs tabular-nums text-ink-muted",
  // "Has note" marker, inline before the move.
  noteDot: "mr-1.5 inline-block h-1.5 w-1.5 shrink-0 self-center rounded-full bg-accent",

  // Function, 1 param -> passed directly. A cube row's square in the dice
  // column, coloured as Galaxy colours it: red for a blunder, amber for an
  // error, blue otherwise (lib/styles/shared.styles.ts).
  cubeSquare: (severity: Severity | null): string =>
    clsx(
      "inline-flex h-[18px] w-[18px] items-center justify-center rounded-[4px] font-mono text-[10.5px] font-bold leading-none",
      severity === "blunder"
        ? shared.severityChip("blunder")
        : severity === "error"
          ? shared.severityChip("error")
          : shared.cubeSquareDefault
    ),
} as const;
