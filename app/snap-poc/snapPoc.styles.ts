import clsx from "clsx";
import { style as shared } from "@/lib/styles/shared.styles";

// Page-local styles for app/snap-poc (page.tsx and SnapPocReview.tsx): the
// dev-only Snaps proof-of-concept review page.
export const style = {
  root: "flex flex-col gap-6",
  emptyNote: shared.infoBox,
  // Summary table.
  imageName: "max-w-[14rem] truncate text-left text-sm",
  rowButton: (isCurrent: boolean): string =>
    clsx(shared.textLink, "max-w-[14rem] truncate text-left", isCurrent && "font-semibold"),
  totalRow: "bg-sunken font-medium",
  okMark: (ok: boolean): string => (ok ? "text-ink" : "text-blunder-ink"),
  // Navigation bar above the photo.
  navBar: "flex flex-wrap items-center justify-between gap-3",
  navButtons: "flex flex-wrap items-center gap-2",
  navButton: "whitespace-nowrap",
  navStatus: "text-sm tabular-nums text-ink-muted",
  currentName: "min-w-0 truncate font-serif text-ink",
  // Photo + builder.
  workArea: "grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,5fr)] lg:items-start",
  photoColumn: "flex min-w-0 flex-col gap-4 lg:sticky lg:top-4",
  photoCard: "flex items-center justify-center p-2",
  photo: "max-h-[75vh] w-full object-contain",
  infoCard: "flex flex-col gap-3 p-4",
  infoTitle: shared.overline,
  infoText: "text-sm leading-6 text-ink-muted",
  infoError: shared.errorText,
  fieldLabel: shared.filterField,
  // "I am": a two-way choice (a fact about the photo), so a segmented
  // control, set apart from the on/off board-view toggles below it.
  segmented: "grid max-w-[16rem] grid-cols-2 gap-1 rounded-control bg-sunken p-[3px] ring-1 ring-inset ring-line",
  segmentOption: (selected: boolean): string =>
    clsx(
      "rounded-inset px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-40",
      selected ? "bg-surface text-ink shadow-card ring-1 ring-inset ring-line-strong" : "text-ink-muted hover:text-ink"
    ),
  fieldHint: "text-xs leading-5 text-ink-faint",
  // The board-view group, ruled off from "I am" above it.
  viewGroup: clsx(shared.filterField, "border-t border-line pt-3"),
  // The board-view toggles: separate Buttons side by side, not a segmented
  // control, so each reads as on or off by itself.
  toggleRow: "flex flex-wrap gap-2",
  resetLink: clsx(shared.textButton, "self-start"),
  // The builder's extra actions card.
  saveCard: "flex flex-col gap-3 p-4",
  saveError: shared.errorText,
  saveTrialNote: "text-sm leading-6 text-ink-muted",
  scoreList: "grid grid-cols-2 gap-x-4 gap-y-1 text-sm",
  scoreLabel: "text-ink-faint",
  scoreValue: "tabular-nums text-ink",
} as const;
