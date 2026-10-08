import clsx from "clsx";
import { style as shared } from "@/lib/styles/shared.styles";

// Page-local (see .claude/skills/styling-conventions) — covers
// SettingsPage (page.tsx), its Row, and ThemeSettings.tsx, used only by this
// page.
export const style = {
  // On top of Card.
  section: "flex flex-col gap-4 p-5",
  sectionHead: "flex flex-col gap-1",
  sectionTitle: shared.overline,
  sectionNote: "text-[13px] text-ink-muted",

  // --- ThemeSettings.tsx: the theme picker ---
  themeGrid: "grid grid-cols-1 gap-3 md:grid-cols-3",
  // Function, 1 param -> passed directly. One theme's option: a label
  // wrapping its radio, name and preview; the chosen one outlined in ink.
  themeOption: (selected: boolean): string =>
    clsx(
      "flex cursor-pointer flex-col gap-3 rounded-control border p-3 transition-colors",
      "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus",
      selected ? "border-ink" : "border-line hover:border-line-strong"
    ),
  themeOptionHead: "flex items-center gap-2.5",
  themeRadio: "h-4 w-4 shrink-0 accent-ink focus-visible:outline-none",
  themeName: "text-sm font-medium text-ink",
  themeFonts: "text-xs text-ink-faint",

  // The live preview: its own data-theme/data-mode, so every token below
  // is that theme's (app/themes/*.css), whatever the page's own theme is.
  preview: "flex flex-col gap-2.5 rounded-[8px] border border-line bg-paper p-3 text-ink",
  previewTitleRow: "flex items-baseline justify-between gap-2",
  previewTitle: "font-serif text-[22px] font-display leading-none text-ink",
  previewVerdict: clsx("font-serif text-[15px] font-display font-emphasis leading-none", shared.severityText("best")),
  swatchRow: "flex items-center gap-1.5",
  // Function, 1 param -> passed directly. A swatch: a small round colour
  // chip, outlined so a paper-coloured one still shows.
  swatch: (token: PreviewSwatch): string =>
    clsx(
      "h-5 w-5 rounded-full border border-line-strong",
      token === "paper" && "bg-paper",
      token === "surface" && "bg-surface",
      token === "ink" && "bg-ink",
      token === "accent" && "bg-accent",
      token === "primary" && "bg-primary"
    ),
  // A mini board: the frame, the bone with two points, and both checkers.
  board: "ml-auto flex h-5 items-center gap-[3px] rounded-[4px] bg-board-frame px-[3px]",
  boardBone: "flex h-[14px] items-end gap-[2px] rounded-[2px] bg-board-bone px-[2px]",
  // Function, 1 param -> passed directly.
  boardPoint: (dark: boolean): string =>
    clsx("h-[11px] w-[6px] [clip-path:polygon(0_100%,50%_0,100%_100%)]", dark ? "bg-board-point-dark" : "bg-board-point-light"),
  // Function, 1 param -> passed directly.
  boardChecker: (side: "mine" | "opponent"): string =>
    clsx(
      "h-[10px] w-[10px] rounded-full border",
      side === "mine" ? "border-checker-mine-rim bg-checker-mine" : "border-checker-opp-rim bg-checker-opp"
    ),
  chipRow: "flex flex-wrap gap-1",

  // --- ThemeSettings.tsx: the mode switch (a segmented control) ---
  modeTrack: "inline-flex w-fit gap-1 rounded-control bg-sunken p-[3px] ring-1 ring-inset ring-line",
  // Function, 1 param -> passed directly. The chosen mode raised on the
  // track; the radio inside is visually hidden.
  modeOption: (selected: boolean): string =>
    clsx(
      "cursor-pointer rounded-[7px] px-4 py-1.5 text-sm font-medium transition-colors",
      "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus",
      selected ? "bg-surface text-ink shadow-card ring-1 ring-inset ring-line-strong" : "text-ink-muted hover:text-ink"
    ),
  modeRadio: "sr-only",

  // --- page.tsx: the review settings, read-only ---
  rowList: "flex flex-col",
  rowWrapper: "flex items-center justify-between gap-4 border-t border-line py-2.5 text-[13.5px]",
  rowLabel: "text-ink-muted",
  rowValue: "whitespace-nowrap text-right tabular-nums text-ink",
} as const;

export type PreviewSwatch = "paper" | "surface" | "ink" | "accent" | "primary";
