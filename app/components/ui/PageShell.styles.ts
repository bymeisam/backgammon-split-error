import clsx from "clsx";

// One page width for every page, the navbar's (1240px), so the title's left
// edge never moves between tabs. "medium" (lists and tables) and "narrow"
// (/status) only cap the content column inside it, left-aligned to the
// same edge; "wide" (the board pages) uses all of it.
export type PageWidth = "narrow" | "medium" | "wide";

// Shared/promoted component (see .claude/skills/styling-conventions) —
// covers PageShell.tsx, the one page container every page renders into.
export const style = {
  pageContainer: "flex flex-1 justify-center bg-paper",
  main: "flex w-full max-w-[1240px] flex-col px-6 pb-16 pt-10",
  // Function, 1 param -> passed directly. The content column.
  column: (width: PageWidth): string =>
    clsx(
      "flex w-full flex-col gap-8",
      width === "narrow" && "max-w-2xl",
      width === "medium" && "max-w-4xl"
    ),
  // Breadcrumbs above the title row.
  header: "flex flex-col gap-2.5",
  // Title (and subtitle) on the left, the page's actions on the right.
  titleRow: "flex flex-wrap items-end justify-between gap-3",
  titleBlock: "flex min-w-0 flex-col gap-2",
  title: "font-serif text-[2rem] font-medium leading-[1.08] tracking-[-0.018em] text-ink md:text-display",
  subtitle: "text-[14.5px] text-ink-muted",
  actions: "flex flex-wrap items-center gap-x-5 gap-y-2 text-sm",
} as const;
