import clsx from "clsx";
import type { RuntimeModeLabel } from "@/lib/runtimeMode";
import { style as shared } from "@/lib/styles/shared.styles";

// Shared/promoted component (see .claude/skills/styling-conventions) —
// covers AppNav.tsx (the navbar in the root layout) and the subcomponents
// only it uses, all in this folder: NavLinks.tsx, SyncControl.tsx and
// ShortcutsHelp.tsx.
export const style = {
  // --- NavLinks.tsx ---
  // The same 1240px width as every page. Not sticky or translucent yet: a
  // sticky bar would cover the top of whatever a page scrolls into view
  // (the visual suite's element screenshots included), and a backdrop
  // filter here would make the bar the containing block of the "?" help's
  // fixed overlay (rendered inside it), pinning the dialog to the bar. The
  // report's navbar restyle (#10) handles both.
  bar: "relative z-40 border-b border-line bg-surface",
  inner: "mx-auto flex min-h-14 w-full max-w-[1240px] flex-wrap items-center gap-x-6 px-6",
  brand: "whitespace-nowrap font-serif text-xl font-medium tracking-tight text-ink",
  // Function, 1 param -> passed directly. A dot plus text, coloured by where
  // writes go: amber when they go to Oracle (the real database), whatever
  // the reads use; green for the local one; grey read-only.
  modeBadge: (label: RuntimeModeLabel): string =>
    clsx(
      "inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium before:h-1.5 before:w-1.5 before:rounded-full",
      (label === "Oracle · write" || label === "Writes: Oracle · Reads: Local") && "text-mode-warn before:bg-mode-warn",
      (label === "Local · write" || label === "Writes: Local · Reads: Oracle") && "text-ink-muted before:bg-mode-ok",
      label === "Read-only" && "text-ink-muted before:bg-ink-faint"
    ),
  // Narrow screens only: opens/closes the item list.
  menuButton: clsx(shared.buttonSmall, "ml-auto md:hidden"),
  // Function, 1 param -> passed directly. A row on wide screens; on narrow
  // ones a full-width sheet, shown only while the menu is open.
  menu: (open: boolean): string =>
    clsx(
      "w-full flex-col border-t border-line pb-3 md:flex md:w-auto md:flex-1 md:flex-row md:items-center md:justify-between md:border-t-0 md:pb-0",
      open ? "flex" : "hidden"
    ),
  list: "flex flex-col md:flex-row md:items-center md:gap-5",
  endGroup:
    "flex flex-col gap-2 border-t border-line pt-3 md:flex-row md:items-center md:gap-4 md:border-t-0 md:pt-0",
  // An item with sub-items (Review › Cards): the dropdown opens on hover or
  // keyboard focus inside it on wide screens.
  itemWithChildren: "group relative",
  // Function, 1 param -> passed directly. 44px rows in the narrow sheet,
  // marked on the left; on wide screens the active item is underlined.
  link: (active: boolean): string =>
    clsx(
      "inline-flex h-11 w-full items-center gap-1.5 border-l-2 pl-3 text-[13.5px] font-medium transition-colors",
      "md:h-14 md:w-auto md:border-b-2 md:border-l-0 md:pl-0",
      active ? "border-ink text-ink" : "border-transparent text-ink-muted hover:text-ink"
    ),
  subList: clsx(
    "flex flex-col pl-4",
    "md:absolute md:left-[-0.75rem] md:top-full md:z-40 md:hidden md:min-w-36 md:rounded-control md:border md:border-line md:bg-surface md:p-1 md:pl-1 md:shadow-raised md:group-hover:flex md:group-focus-within:flex"
  ),
  // Function, 1 param -> passed directly. A dropdown item.
  subLink: (active: boolean): string =>
    clsx(
      "flex h-11 items-center rounded-control px-3 text-[13.5px] font-medium transition-colors md:h-9",
      active ? "text-ink md:bg-sunken" : "text-ink-muted hover:bg-sunken hover:text-ink"
    ),
  // The number of review cards due, on the Review item (write mode only).
  dueBadge:
    "inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-semibold tabular-nums text-on-accent",

  // --- SyncControl.tsx ---
  syncBox: "flex flex-wrap items-center gap-2.5 text-xs text-ink-faint",
  syncButton: shared.buttonSmall,
  syncLink: "underline decoration-line-strong underline-offset-4 hover:text-ink",
  // Function, 1 param -> passed directly. The last sync's own result.
  syncMessage: (ok: boolean): string => clsx("max-w-64 truncate", ok ? "text-best-ink" : "text-blunder-ink"),

  // --- ShortcutsHelp.tsx ---
  helpButton:
    "inline-flex h-[30px] min-w-[30px] items-center self-start md:self-auto justify-center rounded-control border border-line px-2 text-[13px] font-semibold text-ink-muted transition-colors hover:bg-sunken hover:text-ink",
  modalOverlay: shared.modalOverlay,
  modalPanel: shared.modalPanel,
  modalHeading: shared.modalHeading,
  modalButtons: shared.modalButtons,
  modalSecondaryButton: shared.modalSecondaryButton,
  helpGroups: "flex flex-col gap-4",
  helpGroupTitle: clsx(shared.overline, "mb-1.5"),
  helpRow: "flex items-baseline gap-3 py-0.5 text-sm text-ink-muted",
  helpKeys: "flex w-28 shrink-0 flex-wrap gap-1",
  kbd: shared.kbd,
} as const;
