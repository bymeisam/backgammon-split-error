import clsx from "clsx";
import type { SeverityTier } from "@/lib/badges";
import { style as shared } from "@/lib/styles/shared.styles";

// The arrows' three colours (theme tokens, at least 3:1 on the bone).
export type ArrowTier = "best" | "error" | "blunder";

// Shared/promoted component (see .claude/skills/styling-conventions) —
// used by /matches/[matchId], /galaxy/matches/[matchId] (via
// MistakesSection.tsx), /mistakes and /repeated-positions (via
// DecisionCard.tsx), the game replay (GameReplay.tsx) and the review
// session. Covers both BoardPanel.tsx and Board.tsx, its own subcomponent
// (exclusively used by BoardPanel, same folder). Dice.tsx is NOT covered
// here — it's also used independently by DecisionList.tsx, so it gets its
// own Dice.styles.ts.
export const style = {
  panelStack: "flex flex-col gap-4",
  // The board isn't in a card any more: its own frame is the container.
  panel: "flex flex-col items-center gap-4",
  emptyState: "text-sm text-ink-muted",
  infoRow: "flex flex-wrap items-stretch justify-center gap-2 text-xs",
  gameBadge: "flex items-center gap-1.5 rounded-control border border-line bg-surface px-3 py-2",
  gameBadgeLabel: "text-ink-faint",
  gameBadgeValue: "font-semibold tabular-nums text-ink",
  moveNotation: "font-mono text-[13px] font-medium",
  // Shared by the error-magnitude text ("(0.028)") and the static "My
  // move"/"Best move" labels.
  mutedLabel: "text-ink-muted",
  // The opponent's half of a Double/Too good best action ("opponent should
  // take"), small after the label.
  bestDetail: "text-[10.5px] text-ink-faint",

  // Function, 3+ params -> one options object. The my-move and best-move
  // boxes under the board, as buttons (onSelectTab given) or static boxes:
  // the shown one tinted in its severity with a bar on the left, the other
  // quiet. The move text itself is in the severity's ink colour.
  decisionChip: (opts: { tier: SeverityTier; isActive: boolean; isButton: boolean }): string =>
    clsx(
      "flex items-center gap-1.5 rounded-control border px-3 py-2 transition-colors",
      shared.severityText(opts.tier),
      opts.isActive
        ? clsx(
            opts.tier === "best" && "border-best/60 bg-best-tint shadow-[inset_3px_0_0_var(--best)]",
            opts.tier === "good" && "border-good/60 bg-surface shadow-[inset_3px_0_0_var(--good)]",
            opts.tier === "error" && "border-error/60 bg-error-tint shadow-[inset_3px_0_0_var(--error)]",
            opts.tier === "blunder" && "border-blunder/60 bg-blunder-tint shadow-[inset_3px_0_0_var(--blunder)]"
          )
        : clsx("border-line bg-surface", opts.isButton && "opacity-85 hover:opacity-100")
    ),

  // --- Board.tsx ---
  boardSvg: "w-full drop-shadow-board",
  boardFrame: "fill-board-frame",
  boardSurface: "fill-board-bone",
  boardTray: "fill-board-tray",
  // Function, 1 param -> passed directly. Alternating point colours.
  point: (isDark: boolean): string => (isDark ? "fill-board-point-dark" : "fill-board-point-light"),
  // The point numbers sit in the frame. Sizes are in board units (the SVG
  // scales): large on a phone, where the board renders at about 0.4x, and
  // smaller from sm up, where it renders near full size.
  pointNumber: "fill-board-number text-[22px] font-medium tabular-nums sm:text-[14px]",
  offSlotEmpty: "stroke-board-number/25",
  // Function, 1 param -> passed directly. The faint inner ring that makes a
  // checker look turned.
  checkerRing: (side: "mine" | "opponent"): string =>
    clsx("fill-none [stroke-width:1]", side === "mine" ? "stroke-white/15" : "stroke-black/12"),
  // Function, 1 param -> passed directly. Sets currentColor for the arrow
  // group: lines, heads, hit rings and ×N counts.
  arrow: (tier: ArrowTier): string =>
    clsx(
      tier === "best" && "text-arrow-best",
      tier === "error" && "text-arrow-error",
      tier === "blunder" && "text-arrow-blunder"
    ),
  arrowHalo: "stroke-board-bone opacity-75",
  arrowCountHalo: "stroke-board-bone",
  diceWrapper: "flex h-full w-full items-center justify-center",
} as const;
