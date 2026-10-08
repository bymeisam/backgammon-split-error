import clsx from "clsx";

// Three page widths, the ones the pages already used: lists and tables
// (medium, max-w-4xl), board pages (wide, max-w-7xl) and /status (narrow,
// max-w-2xl).
export type PageWidth = "narrow" | "medium" | "wide";

// Shared/promoted component (see .claude/skills/styling-conventions) —
// covers PageShell.tsx, the one page container every page renders into
// (replacing each page's own pageContainer/main/title/subtitle copies).
export const style = {
  pageContainer: "flex flex-1 justify-center bg-zinc-50 dark:bg-black",
  // Function, 1 param -> passed directly.
  main: (width: PageWidth): string =>
    clsx(
      "flex w-full flex-col gap-6 px-6 py-12",
      width === "narrow" && "max-w-2xl",
      width === "medium" && "max-w-4xl",
      width === "wide" && "max-w-7xl"
    ),
  // Breadcrumbs above the title row.
  header: "flex flex-col gap-2",
  // Title (and subtitle) on the left, the page's actions on the right.
  titleRow: "flex flex-wrap items-center justify-between gap-3",
  titleBlock: "flex min-w-0 flex-col gap-1",
  title: "text-2xl font-semibold tracking-tight text-black dark:text-zinc-50",
  subtitle: "text-sm text-zinc-600 dark:text-zinc-400",
  actions: "flex flex-wrap items-center gap-x-4 gap-y-2",
} as const;
