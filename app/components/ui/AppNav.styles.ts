import clsx from "clsx";
import type { RuntimeModeLabel } from "@/lib/runtimeMode";
import { style as shared } from "@/lib/styles/shared.styles";

// Shared/promoted component (see .claude/skills/styling-conventions) —
// covers AppNav.tsx (the navbar in the root layout) and the subcomponents
// only it uses, all in this folder: NavLinks.tsx and ShortcutsHelp.tsx.
export const style = {
  // --- NavLinks.tsx ---
  // Sticky and translucent, the same 1240px width as every page. The "?"
  // help is a native <dialog> (top layer), so the backdrop filter here
  // doesn't trap it; the visual suite un-sticks the bar while it
  // screenshots (e2e/screenshot.css, via data-app-nav).
  bar: "sticky top-0 z-40 border-b border-line bg-nav-bg backdrop-blur-[10px]",
  inner: "relative mx-auto flex h-14 w-full max-w-[1240px] items-center gap-3 px-4 md:px-6 lg:gap-6",
  brand:
    "flex items-center gap-2.5 whitespace-nowrap font-serif text-[20px] font-display leading-none tracking-[-0.01em] text-ink",
  // The "Game Review" wordmark: screen-reader-only from lg to xl, where the
  // full row is tightest (the checker mark stays, and the link keeps its
  // accessible name; an sr-only span is absolutely positioned, so it takes
  // no flex gap). Visible below lg (the Menu layout) and from xl.
  brandText: "lg:max-xl:sr-only",
  brandMark: "h-[22px] w-[22px] shrink-0",
  brandMarkBack: "fill-current",
  brandMarkFront: "fill-surface stroke-current",
  // Function, 2 params -> passed directly. A 7px dot plus text, coloured by
  // where writes go: amber when they go to Oracle (the real database),
  // whatever the reads use; green for the local one; grey read-only. In the
  // bar itself below lg, first in the end group from lg.
  modeBadge: (label: RuntimeModeLabel, placement: "bar" | "end"): string =>
    clsx(
      "items-center gap-1.5 whitespace-nowrap text-[12.5px] font-medium before:h-[7px] before:w-[7px] before:rounded-full",
      placement === "bar" ? "inline-flex lg:hidden" : "hidden lg:inline-flex",
      (label === "Oracle · write" || label === "Writes: Oracle · Reads: Local") && "text-mode-warn before:bg-mode-warn",
      (label === "Local · write" || label === "Writes: Local · Reads: Oracle") && "text-ink-muted before:bg-mode-ok",
      label === "Read-only" && "text-ink-muted before:bg-ink-faint"
    ),
  // Below lg: the mode badge and the Menu button, at the right of the bar.
  narrowEnd: "ml-auto flex items-center gap-3 lg:hidden",
  menuButton:
    "inline-flex h-[30px] items-center rounded-[8px] border border-line px-3 text-[13px] font-semibold text-ink-muted hover:bg-sunken hover:text-ink",
  // Function, 1 param -> passed directly. Below lg: an opaque sheet under
  // the bar, shown only while the menu is open. Full width below md; from md
  // to lg a 320px panel anchored to the right edge (no stretched phone sheet
  // on a tablet). From lg: the row, with a guaranteed 32px between the links
  // and the end group.
  menu: (open: boolean): string =>
    clsx(
      "absolute inset-x-0 top-full flex-col border-b border-line bg-surface pb-1 shadow-raised",
      "md:left-auto md:right-6 md:w-80 md:rounded-b-card md:border-x",
      "lg:static lg:flex lg:h-full lg:w-auto lg:flex-1 lg:flex-row lg:items-center lg:gap-8 lg:rounded-none lg:border-x-0 lg:border-b-0 lg:bg-transparent lg:pb-0 lg:shadow-none",
      open ? "flex" : "hidden"
    ),
  list: "flex flex-col py-1 lg:h-full lg:flex-row lg:gap-5 lg:py-0",
  item: "lg:h-full",
  // An item with sub-items (Review › Cards): on wide screens the dropdown
  // opens on hover or keyboard focus inside it.
  itemWithChildren: "group relative lg:h-full",
  // Function, 1 param -> passed directly. 44px rows in the narrow sheet,
  // the active one marked with a 2px bar on the left; on wide screens the
  // active item is underlined.
  link: (active: boolean): string =>
    clsx(
      "flex h-11 items-center gap-1.5 border-l-2 px-4 text-[13.5px] font-medium transition-colors",
      "lg:-mb-px lg:h-full lg:border-b-2 lg:border-l-0 lg:px-0",
      active ? "border-ink text-ink" : "border-transparent text-ink-muted hover:text-ink"
    ),
  subList: clsx(
    "flex flex-col",
    "lg:absolute lg:left-[-0.75rem] lg:top-full lg:z-40 lg:hidden lg:min-w-36 lg:rounded-control lg:border lg:border-line lg:bg-surface lg:p-1 lg:shadow-raised lg:group-hover:flex lg:group-focus-within:flex"
  ),
  // Function, 1 param -> passed directly. A sub-item: indented 16px in the
  // sheet, a dropdown row from lg.
  subLink: (active: boolean): string =>
    clsx(
      "flex h-11 items-center border-l-2 pl-8 pr-4 text-[13.5px] font-medium transition-colors lg:h-9 lg:rounded-control lg:border-l-0 lg:px-3",
      active ? "border-ink text-ink lg:bg-sunken" : "border-transparent text-ink-muted hover:bg-sunken hover:text-ink"
    ),
  // The number of review cards due, on the Review item (write mode only).
  dueBadge:
    "inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent px-[5px] text-[11px] font-semibold tabular-nums text-on-accent",
  // The right end of the bar from lg; the sheet's lower part below lg (a
  // hairline, then Settings, Status and "?").
  endGroup:
    "flex flex-col border-t border-line text-[12.5px] text-ink-faint lg:ml-auto lg:flex-row lg:items-center lg:gap-3 lg:whitespace-nowrap lg:border-t-0",
  // The end cluster: Settings, Status and "?" behind a hairline from lg.
  // Below lg, the sheet's foot row: Settings and Status on the left, "?"
  // pushed to the right, under endGroup's own hairline (no second one now
  // that the sync row between them is gone).
  footRow: "flex items-center gap-5 border-line px-4 py-2 lg:gap-3 lg:border-l lg:py-0 lg:pl-3 lg:pr-0",
  // Function, 1 param -> passed directly. Settings and Status.
  endLink: (active: boolean): string =>
    clsx("transition-colors hover:text-ink", active ? "text-ink" : "text-ink-faint"),

  // --- ShortcutsHelp.tsx ---
  helpButton:
    "ml-auto inline-flex h-[30px] w-[30px] items-center justify-center rounded-[8px] border border-line text-[13px] font-semibold text-ink-muted transition-colors hover:bg-sunken hover:text-ink lg:ml-0",
  modalHeading: shared.modalHeading,
  modalButtons: shared.modalButtons,
  modalSecondaryButton: shared.modalSecondaryButton,
  helpGroups: "flex flex-col gap-4",
  helpGroupTitle: clsx(shared.overline, "mb-1.5"),
  helpRow: "grid grid-cols-[7rem_minmax(0,1fr)] items-baseline gap-x-3 py-0.5 text-sm text-ink-muted",
  helpKeys: "flex flex-wrap items-baseline gap-1",
  // The "/" between alternative keys ("↓ / J").
  helpKeySeparator: "text-ink-faint",
  kbd: shared.kbd,
} as const;
