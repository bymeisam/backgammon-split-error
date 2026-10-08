import clsx from "clsx";
import { style as shared } from "@/lib/styles/shared.styles";

// One page width for every page, the navbar's (1240px), so the title's left
// edge never moves between tabs. "medium" (lists and tables) and "narrow"
// (/status) only cap the content column inside it, left-aligned to the
// same edge; "wide" (the board pages) uses all of it.
export type PageWidth = "narrow" | "medium" | "wide";

// See PageShell.tsx.
export type PageVariant = "page" | "detail" | "session";

// Shared/promoted component (see .claude/skills/styling-conventions) —
// covers PageShell.tsx, the one page container every page renders into.
export const style = {
  pageContainer: "flex flex-1 justify-center bg-paper",
  // Function, 1 param -> passed directly. The mockups' .page paddings.
  main: (variant: PageVariant): string =>
    clsx(
      "flex w-full max-w-[1240px] flex-col",
      variant === "page" && "px-4 pb-16 pt-7 md:px-6 md:pb-[72px] md:pt-11",
      variant === "detail" && "px-0 pb-16 pt-[18px] md:px-6 md:pb-[72px] md:pt-7",
      variant === "session" && "px-0 pb-24 pt-4 md:px-6 md:pb-[72px] md:pt-6"
    ),
  // Function, 2 params -> passed directly. The content column.
  column: (width: PageWidth, variant: PageVariant): string =>
    clsx(
      "flex w-full flex-col",
      variant === "page" ? "gap-7 md:gap-9" : "gap-6",
      width === "narrow" && "max-w-2xl",
      width === "medium" && "max-w-4xl"
    ),
  // Function, 1 param -> passed directly. Breadcrumbs above the title row;
  // inset below md on the pages without side padding there.
  header: (variant: PageVariant): string =>
    clsx("flex flex-col gap-2.5", variant !== "page" && "px-4 md:px-0"),
  // Function, 1 param -> passed directly. Title (and subtitle) on the left,
  // the page's actions on the right: on the baseline of the title for a
  // list page, at the bottom of the header block on a board page.
  titleRow: (variant: PageVariant): string =>
    clsx("flex flex-wrap justify-between gap-4", variant === "page" ? "items-baseline" : "items-end"),
  titleBlock: "flex min-w-0 flex-col",
  overline: shared.overline,
  // Function, 2 params -> passed directly. The display title on a list page
  // (32px below md, 38 from md); the replay's 26/32 on a board page.
  title: (variant: PageVariant, hasOverline: boolean): string =>
    clsx(
      "font-serif font-medium text-ink",
      variant === "page"
        ? "text-[2rem] leading-[1.08] tracking-[-0.018em] md:text-display"
        : "text-[26px] leading-[1.1] tracking-[-0.015em] md:text-[32px]",
      hasOverline && "mt-2.5"
    ),
  // Function, 1 param -> passed directly.
  subtitle: (variant: PageVariant): string =>
    clsx(variant === "page" ? "mt-2 text-[14.5px] text-ink-muted" : "mt-1.5 text-[13px] text-ink-faint"),
  actions: "flex flex-wrap items-center gap-x-[18px] gap-y-2 text-sm",
  // The italic "vs" in a board page's title ("Game 2 vs cbj2").
  titleVs: "font-normal italic text-ink-muted",
} as const;
