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
  // The Orientation card: two steps, one active at a time. The inactive
  // step's controls are disabled (native `disabled`) and show their values.
  orientationCard: "flex flex-col gap-3.5 p-4",
  // Function, 2 params -> passed directly. Step 2 is ruled off from step 1.
  step: (active: boolean, ruled: boolean): string =>
    clsx("flex flex-col gap-2.5", ruled && "border-t border-line pt-3.5", !active && "text-ink-muted"),
  stepHead: "flex items-center gap-2 text-sm font-semibold",
  // Function, 1 param -> passed directly. The step's number (✓ once done).
  stepNumber: (active: boolean): string =>
    clsx(
      "inline-grid size-[22px] flex-none place-items-center rounded-full text-xs font-semibold",
      active ? "bg-primary text-on-primary" : "bg-sunken text-ink-muted ring-1 ring-inset ring-line-strong"
    ),
  stepTitle: (active: boolean): string => (active ? "text-ink" : "text-ink-muted"),
  stepTag: "ml-auto text-[11px] font-medium text-ink-faint",
  // A labelled control in step 2: the name on the left, the control after it.
  fieldRow: "grid grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-2 text-sm",
  fieldName: "font-medium text-ink-muted",
  // Function, 1 param -> passed directly. A radio group drawn as a
  // segmented control: Analyzing for (2 options), Home board (4).
  segmented: (columns: 2 | 4): string =>
    clsx(
      "grid gap-1 rounded-control bg-sunken p-[3px] ring-1 ring-inset ring-line",
      columns === 2 ? "max-w-[12rem] grid-cols-2" : "max-w-[12rem] grid-cols-4"
    ),
  segmentOption: (selected: boolean): string =>
    clsx(
      "rounded-inset px-3 py-1.5 text-sm font-medium tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-40",
      selected ? "bg-surface text-ink shadow-card ring-1 ring-inset ring-line-strong" : "text-ink-muted hover:text-ink"
    ),
  fieldHint: "text-xs leading-5 text-ink-muted",
  // Step 1's view toggles: separate Buttons side by side, each on or off.
  toggleRow: "flex flex-wrap gap-2",
  nextButton: "self-start",
  // Step 2's legend: each colour, a disc in its drawn colour, and its home.
  legend: "grid gap-0.5 text-xs leading-5 text-ink-muted",
  legendItem: "inline-flex items-center gap-1.5",
  // Function, 1 param -> passed directly. The disc in the colour Board draws
  // that colour's checkers in (Swap colours flips it).
  legendDisc: (palette: "mine" | "opponent"): string =>
    clsx(
      "inline-block size-[11px] flex-none rounded-full ring-[1.5px]",
      palette === "mine" ? "bg-checker-mine ring-checker-mine-rim" : "bg-checker-opp ring-checker-opp-rim"
    ),
  // The "turn the board" nudge when the analysed colour is drawn at the top.
  nudge: "rounded-control bg-sunken px-2.5 py-2 text-xs leading-5 text-ink-muted",
  nudgeLink: shared.textButton,
  backButton: "self-start",
  resetLink: clsx(shared.textButton, "self-start"),
  // The builder's extra actions card.
  saveCard: "flex flex-col gap-3 p-4",
  saveError: shared.errorText,
  saveHint: "text-sm leading-6 text-ink-muted",
  scoreList: "grid grid-cols-2 gap-x-4 gap-y-1 text-sm",
  scoreLabel: "text-ink-faint",
  scoreValue: "tabular-nums text-ink",
} as const;
