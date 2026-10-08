import clsx from "clsx";
import type { RuntimeModeLabel } from "@/lib/runtimeMode";
import { style as shared } from "@/lib/styles/shared.styles";

// Shared/promoted component (see .claude/skills/styling-conventions) —
// covers AppNav.tsx (the navbar in the root layout) and the subcomponents
// only it uses, all in this folder: NavLinks.tsx, SyncControl.tsx and
// ShortcutsHelp.tsx.
export const style = {
  // --- NavLinks.tsx ---
  // Sticky and translucent, the same 1240px width as every page. The "?"
  // help is a native <dialog> (top layer), so the backdrop filter here
  // doesn't trap it; the visual suite un-sticks the bar while it
  // screenshots (e2e/screenshot.css, via data-app-nav).
  bar: "sticky top-0 z-40 border-b border-line bg-nav-bg backdrop-blur-[10px]",
  inner: "relative mx-auto flex h-14 w-full max-w-[1240px] items-center gap-3 px-4 md:gap-8 md:px-6",
  brand:
    "flex items-center gap-2.5 whitespace-nowrap font-serif text-[20px] font-medium leading-none tracking-[-0.01em] text-ink",
  brandMark: "h-[22px] w-[22px] shrink-0",
  brandMarkBack: "fill-current",
  brandMarkFront: "fill-surface stroke-current",
  // Function, 2 params -> passed directly. A 7px dot plus text, coloured by
  // where writes go: amber when they go to Oracle (the real database),
  // whatever the reads use; green for the local one; grey read-only. In the
  // bar itself below md, first in the end group from md.
  modeBadge: (label: RuntimeModeLabel, placement: "bar" | "end"): string =>
    clsx(
      "items-center gap-1.5 whitespace-nowrap text-[12.5px] font-medium before:h-[7px] before:w-[7px] before:rounded-full",
      placement === "bar" ? "inline-flex md:hidden" : "hidden md:inline-flex",
      (label === "Oracle · write" || label === "Writes: Oracle · Reads: Local") && "text-mode-warn before:bg-mode-warn",
      (label === "Local · write" || label === "Writes: Local · Reads: Oracle") && "text-ink-muted before:bg-mode-ok",
      label === "Read-only" && "text-ink-muted before:bg-ink-faint"
    ),
  // Below md: the mode badge and the Menu button, at the right of the bar.
  narrowEnd: "ml-auto flex items-center gap-3 md:hidden",
  menuButton:
    "inline-flex h-[30px] items-center rounded-[8px] border border-line px-3 text-[13px] font-semibold text-ink-muted hover:bg-sunken hover:text-ink",
  // Function, 1 param -> passed directly. A row filling the bar from md;
  // below md a full-width opaque sheet under the bar, shown only while the
  // menu is open.
  menu: (open: boolean): string =>
    clsx(
      "absolute inset-x-0 top-full flex-col border-b border-line bg-surface pb-1 shadow-raised",
      "md:static md:flex md:h-full md:flex-1 md:flex-row md:items-center md:border-b-0 md:bg-transparent md:pb-0 md:shadow-none",
      open ? "flex" : "hidden"
    ),
  list: "flex flex-col py-1 md:h-full md:flex-row md:gap-[22px] md:py-0",
  item: "md:h-full",
  // An item with sub-items (Review › Cards): on wide screens the dropdown
  // opens on hover or keyboard focus inside it.
  itemWithChildren: "group relative md:h-full",
  // Function, 1 param -> passed directly. 44px rows in the narrow sheet,
  // the active one marked with a 2px bar on the left; on wide screens the
  // active item is underlined.
  link: (active: boolean): string =>
    clsx(
      "flex h-11 items-center gap-1.5 border-l-2 px-4 text-[13.5px] font-medium transition-colors",
      "md:-mb-px md:h-full md:border-b-2 md:border-l-0 md:px-0",
      active ? "border-ink text-ink" : "border-transparent text-ink-muted hover:text-ink"
    ),
  subList: clsx(
    "flex flex-col",
    "md:absolute md:left-[-0.75rem] md:top-full md:z-40 md:hidden md:min-w-36 md:rounded-control md:border md:border-line md:bg-surface md:p-1 md:shadow-raised md:group-hover:flex md:group-focus-within:flex"
  ),
  // Function, 1 param -> passed directly. A sub-item: indented 16px in the
  // sheet, a dropdown row from md.
  subLink: (active: boolean): string =>
    clsx(
      "flex h-11 items-center border-l-2 pl-8 pr-4 text-[13.5px] font-medium transition-colors md:h-9 md:rounded-control md:border-l-0 md:px-3",
      active ? "border-ink text-ink md:bg-sunken" : "border-transparent text-ink-muted hover:bg-sunken hover:text-ink"
    ),
  // The number of review cards due, on the Review item (write mode only).
  dueBadge:
    "inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent px-[5px] text-[11px] font-semibold tabular-nums text-on-accent",
  // The right end of the bar from md; the sheet's lower part below md (a
  // hairline, the sync row, then Status and "?").
  endGroup:
    "flex flex-col border-t border-line text-[12.5px] text-ink-faint md:ml-auto md:flex-row md:items-center md:gap-4 md:whitespace-nowrap md:border-t-0",
  syncRow: "px-4 py-3 md:contents",
  footRow: "flex items-center justify-between border-t border-line px-4 py-2 md:contents",
  // Function, 1 param -> passed directly. Status.
  endLink: (active: boolean): string =>
    clsx("transition-colors hover:text-ink", active ? "text-ink" : "text-ink-faint"),

  // --- SyncControl.tsx ---
  syncBox: "flex flex-wrap items-center gap-x-4 gap-y-2 text-[12.5px] text-ink-faint",
  syncButton: shared.buttonSmall,
  syncLink: "underline decoration-line-strong underline-offset-[3px] hover:text-ink",
  // Function, 1 param -> passed directly. The last sync's own result.
  syncMessage: (ok: boolean): string => clsx("max-w-64 truncate", ok ? "text-best-ink" : "text-blunder-ink"),

  // --- ShortcutsHelp.tsx ---
  helpButton:
    "inline-flex h-[30px] w-[30px] items-center justify-center rounded-[8px] border border-line text-[13px] font-semibold text-ink-muted transition-colors hover:bg-sunken hover:text-ink",
  modalHeading: shared.modalHeading,
  modalButtons: shared.modalButtons,
  modalSecondaryButton: shared.modalSecondaryButton,
  helpGroups: "flex flex-col gap-4",
  helpGroupTitle: clsx(shared.overline, "mb-1.5"),
  helpRow: "grid grid-cols-[7rem_minmax(0,1fr)] items-baseline gap-x-3 py-0.5 text-sm text-ink-muted",
  helpKeys: "flex flex-wrap gap-1",
  kbd: shared.kbd,
} as const;
