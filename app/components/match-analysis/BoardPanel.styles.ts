import clsx from "clsx";
import type { SeverityTier } from "@/lib/badges";
import { style as shared } from "@/lib/styles/shared.styles";

// The arrows' colours, one per severity tier (theme tokens, at least 3:1 on
// the bone): the played move's tier (lib/badges.ts's playedMoveTier), or
// best on the Best tab.
export type ArrowTier = SeverityTier;

// Shared/promoted component (see .claude/skills/styling-conventions) —
// used by /matches/[matchId], /galaxy/matches/[matchId] (via
// MistakesSection.tsx), /mistakes and /repeated-positions (via
// DecisionCard.tsx), the game replay (GameReplay.tsx) and the review
// session. Covers both BoardPanel.tsx and Board.tsx, its own subcomponent
// (exclusively used by BoardPanel, same folder). Dice.tsx is NOT covered
// here — it's used independently by DecisionList.tsx, so it gets its own
// Dice.styles.ts.
export const style = {
  panelStack: "flex flex-col gap-4",
  // The board isn't in a card: its own frame is the container.
  panel: "flex flex-col gap-4",
  // Function, 1 param -> passed directly. `bleed`: the page has no side
  // padding below md (the replay, the review session), so the board runs
  // almost edge to edge and the blocks under it are inset.
  boardWrap: (bleed: boolean): string => clsx(bleed && "mx-1.5 md:mx-0"),
  emptyState: "text-sm text-ink-muted",

  // The Played / Best chips under the board: buttons that switch the board
  // between the two (a tablist) where the page can switch, static boxes
  // otherwise.
  // Function, 1 param -> passed directly. Inset from the screen edge when
  // the page bleeds (see boardWrap).
  decisionRow: (bleed: boolean): string => clsx("grid grid-cols-2 gap-2.5", bleed && "mx-3 md:mx-0"),
  // Function, 3+ params -> one options object. The shown one tinted in its
  // severity with a bar on the left, the other quiet.
  decisionChip: (opts: { tier: SeverityTier; isActive: boolean; isButton: boolean }): string =>
    clsx(
      "flex min-w-0 flex-col gap-1 rounded-[11px] border px-3.5 py-3 text-left transition-[opacity,border-color]",
      opts.isActive
        ? clsx(
            opts.tier === "best" && "border-best/70 bg-best-tint shadow-[inset_3px_0_0_var(--color-best)]",
            opts.tier === "good" && "border-good/70 bg-surface shadow-[inset_3px_0_0_var(--color-good)]",
            opts.tier === "error" && "border-error/70 bg-error-tint shadow-[inset_3px_0_0_var(--color-error)]",
            opts.tier === "blunder" && "border-blunder/70 bg-blunder-tint shadow-[inset_3px_0_0_var(--color-blunder)]"
          )
        : clsx("border-line bg-surface", opts.isButton && "opacity-85 hover:opacity-100")
    ),
  decisionLabel:
    "flex items-center gap-2 text-[10.5px] font-semibold uppercase leading-none tracking-[0.08em] text-ink-faint",
  // Function, 1 param -> passed directly. The move in its severity's ink.
  decisionMove: (tier: SeverityTier): string =>
    clsx("break-words font-mono text-[17px] font-medium leading-[1.2]", shared.severityText(tier)),
  decisionLoss: "font-mono text-[12.5px] text-ink-muted",
  // The opponent's half of a Double/Too good best action ("opponent should
  // take"), small under the move.
  bestDetail: "text-[11px] text-ink-faint",

  // --- Board.tsx ---
  boardSvg: "block h-auto w-full drop-shadow-board",
  boardFrame: "fill-board-frame",
  boardSurface: "fill-board-bone",
  boardTray: "fill-board-tray",
  // Function, 1 param -> passed directly. Odd points dark, even light (the
  // mockup's p%2).
  point: (isDark: boolean): string => (isDark ? "fill-board-point-dark" : "fill-board-point-light"),
  // The point numbers sit in the 20u frame band. Sizes are in board units
  // (the SVG scales): 10u renders about 6.7px on a 390px phone, so it's
  // 15u there, and the mockup's 10u from sm up.
  pointNumber: "fill-board-number font-sans text-[15px] font-medium tabular-nums sm:text-[10px]",
  offSlotEmpty: "stroke-board-number/25",
  // Function, 1 param -> passed directly. The faint inner ring that makes a
  // checker look turned.
  checkerRing: (side: "mine" | "opponent"): string =>
    clsx("fill-none [stroke-width:1]", side === "mine" ? "stroke-checker-mine-ring" : "stroke-checker-opp-ring"),
  // The "+N" on a capped stack and the off-tray count.
  stackCount: "font-sans text-[11px] font-semibold",
  cubeText: "font-sans text-[14px] font-semibold",
  dieFrame: "stroke-die-stroke [stroke-width:1]",
  // Function, 1 param -> passed directly. Sets currentColor for the arrow
  // group: shafts, heads, origin dots, hit rings and ×N counts.
  arrow: (tier: ArrowTier): string =>
    clsx(
      tier === "best" && "text-arrow-best",
      tier === "good" && "text-arrow-good",
      tier === "error" && "text-arrow-error",
      tier === "blunder" && "text-arrow-blunder"
    ),
  arrowHalo: "stroke-board-bone opacity-75 [stroke-width:7.5] [stroke-linecap:round]",
  arrowShaft: "[stroke:currentColor] [stroke-width:3.5] [stroke-linecap:round]",
  arrowHead: "fill-current",
  arrowHit: "fill-none [stroke:currentColor] [stroke-width:1.75] [stroke-dasharray:3_2.5]",
  arrowCount:
    "fill-current font-sans text-[11px] font-semibold stroke-board-bone [stroke-width:3] [paint-order:stroke]",
} as const;
