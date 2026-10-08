import clsx from "clsx";
import type { Severity } from "@/lib/mistakes";
import { style as shared } from "@/lib/styles/shared.styles";

// Shared by MistakesSection's two tables, DecisionListWithDetail's list,
// and GameReplay's list (consolidated 2026-10-03). The outer width/
// overflow-y wrapper stays caller-owned (MistakesSection wraps two
// <DecisionList>s in one shared scroll region; DecisionListWithDetail/
// GameReplay each wrap a single one) — not part of this component, which
// starts one level in.
export const style = {
  wrapper: "flex flex-col gap-2",
  header: "flex items-center justify-between",
  title: "font-serif text-lg font-medium text-ink",
  actions: "flex gap-3 text-xs",
  // Shared by both "Select all" and "Select none".
  actionButton: shared.textLink,
  emptyText: shared.mutedText,
  scroll: "overflow-x-auto rounded-card border border-line bg-surface shadow-card",
  table: "w-full border-collapse text-left text-sm",
  headRow: "border-b border-line text-overline uppercase text-ink-faint",
  checkboxHeadCell: "w-8 px-3 pb-2 pt-3",
  // Generic cell padding — head cells, the checkbox/roll body cells.
  cell: "px-3 py-2",
  headCell: "px-3 pb-2 pt-3 font-semibold",
  headCellNumeric: "whitespace-nowrap px-3 pb-2 pt-3 text-right font-semibold",
  // The move text may wrap (between the played and best labels), so the
  // loss column always fits.
  detailCell: "min-w-0 px-3 py-2 font-mono text-[13px]",
  errorCell: "whitespace-nowrap px-3 py-2 text-right font-mono text-xs tabular-nums text-ink-muted",
  // ink-muted, not ink-faint: faint is under 4.5:1 on the selected row.
  indexCell: "px-3 py-2 text-right text-xs tabular-nums text-ink-muted",
  // "Has note" marker, inline before the detail cell's own content.
  noteDot: "mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-accent align-middle",

  // Function, 1 param -> passed directly. A cube row's square in the Roll
  // column, coloured as Galaxy colours it: red for a blunder, amber for an
  // error, blue otherwise (lib/styles/shared.styles.ts).
  cubeSquare: (severity: Severity | null): string =>
    clsx(
      "inline-flex h-[18px] min-w-[18px] items-center justify-center rounded border px-0.5 font-mono text-[10.5px] font-bold leading-none",
      severity === "blunder"
        ? shared.severityChip("blunder")
        : severity === "error"
          ? shared.severityChip("error")
          : shared.cubeSquareDefault
    ),

  // Function, 1 param -> passed directly. Focusable (Enter/Space selects);
  // the selected row has an accent bar on the left.
  row: (isSelected: boolean): string =>
    clsx(
      "cursor-pointer border-b border-l-[3px] border-b-line transition-colors last:border-b-0",
      shared.focusRingInset,
      isSelected ? "border-l-accent bg-accent/[0.08]" : "border-l-transparent hover:bg-sunken"
    ),
} as const;
