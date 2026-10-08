import clsx from "clsx";
import type { RuntimeModeLabel } from "@/lib/runtimeMode";
import { style as shared } from "@/lib/styles/shared.styles";

// Shared/promoted component (see .claude/skills/styling-conventions) —
// covers AppNav.tsx (the navbar in the root layout) and the subcomponents
// only it uses, all in this folder: NavLinks.tsx, SyncControl.tsx and
// ShortcutsHelp.tsx.
export const style = {
  // --- NavLinks.tsx ---
  bar: "border-b border-black/10 bg-white dark:border-white/15 dark:bg-zinc-950",
  inner: "mx-auto flex w-full max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-6 py-2",
  brand: "text-sm font-semibold tracking-tight text-black dark:text-zinc-50",
  // Function, 1 param -> passed directly. Amber when writes go to Oracle
  // (the real database), green for the local one, grey read-only.
  modeBadge: (label: RuntimeModeLabel): string =>
    clsx(
      "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
      label === "Oracle · write" &&
        "border-amber-400 bg-amber-100 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200",
      label === "Local · write" &&
        "border-green-300 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200",
      label === "Read-only" &&
        "border-zinc-300 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
    ),
  // Narrow screens only: opens/closes the item list.
  menuButton:
    "ml-auto rounded-md border border-black/10 px-3 py-1 text-sm font-medium text-black hover:bg-zinc-100 md:hidden dark:border-white/15 dark:text-zinc-100 dark:hover:bg-zinc-800",
  // Function, 1 param -> passed directly. A row on wide screens; on narrow
  // ones a full-width column, shown only while the menu is open.
  menu: (open: boolean): string =>
    clsx(
      "w-full flex-col gap-2 pb-2 md:flex md:w-auto md:flex-1 md:flex-row md:items-center md:justify-between md:pb-0",
      open ? "flex" : "hidden"
    ),
  list: "flex flex-col gap-1 md:flex-row md:items-center",
  endGroup: "flex flex-col gap-2 md:flex-row md:items-center md:gap-3",
  // An item with sub-items (Review › Cards): the dropdown opens on hover or
  // keyboard focus inside it on wide screens.
  itemWithChildren: "group relative",
  // Function, 1 param -> passed directly. The active route is filled.
  link: (active: boolean): string =>
    clsx(
      "inline-flex items-center rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
      active
        ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black"
        : "text-zinc-600 hover:bg-zinc-100 hover:text-black dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
    ),
  subList:
    "flex flex-col gap-1 pl-4 md:absolute md:left-0 md:top-full md:z-40 md:hidden md:min-w-32 md:rounded-lg md:border md:border-black/10 md:bg-white md:p-1 md:shadow-lg md:group-hover:flex md:group-focus-within:flex md:dark:border-white/15 md:dark:bg-zinc-900",
  // The number of review cards due, on the Review item (write mode only).
  dueBadge:
    "ml-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-blue-600 px-1.5 text-xs font-semibold text-white",

  // --- SyncControl.tsx ---
  syncBox: "flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400",
  syncButton:
    "rounded-full border border-black/10 px-3 py-1 text-xs font-medium text-black transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/15 dark:text-zinc-100 dark:hover:bg-zinc-800",
  syncLink: "underline underline-offset-2 hover:text-black dark:hover:text-zinc-100",
  // Function, 1 param -> passed directly. The last sync's own result.
  syncMessage: (ok: boolean): string =>
    clsx("max-w-64 truncate", ok ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"),

  // --- ShortcutsHelp.tsx ---
  helpButton:
    "inline-flex h-7 w-7 items-center justify-center rounded-full border border-black/10 text-sm font-semibold text-zinc-600 hover:bg-zinc-100 hover:text-black dark:border-white/15 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100",
  modalOverlay: shared.modalOverlay,
  modalPanel: shared.modalPanel,
  modalHeading: shared.modalHeading,
  modalButtons: shared.modalButtons,
  modalSecondaryButton: shared.modalSecondaryButton,
  helpGroups: "flex flex-col gap-4",
  helpGroupTitle: "mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400",
  helpRow: "flex items-baseline gap-3 py-0.5 text-sm text-zinc-700 dark:text-zinc-300",
  helpKeys: "flex w-28 shrink-0 flex-wrap gap-1",
  kbd: "rounded border border-black/15 bg-zinc-50 px-1.5 py-0.5 font-mono text-xs text-black dark:border-white/20 dark:bg-zinc-800 dark:text-zinc-100",
} as const;
