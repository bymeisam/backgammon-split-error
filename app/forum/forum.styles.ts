import clsx from "clsx";
import { style as shared } from "@/lib/styles/shared.styles";

export const style = {
  list: "flex flex-col gap-3",
  stack: "flex flex-col gap-6",
  row: "flex flex-col gap-1 p-4",
  // A /forum list card: its title link is stretched over the whole card
  // (listTitleLink), so the card is one link for the mouse and the keyboard.
  listRow: "relative flex flex-col gap-1 p-4 hover:border-line-strong",
  title: "font-serif text-heading text-ink",
  listTitleLink: clsx("font-serif text-heading text-ink", shared.tableRowLink),
  meta: "text-sm text-ink-muted",
  body: "whitespace-pre-wrap text-ink",
  form: "flex flex-col gap-4",
  input: shared.input,
  actions: "flex flex-wrap gap-3",
  // The Reply button sits at the end of the form instead of stretching.
  formActions: "flex justify-end",
  attachmentList: "flex flex-col gap-4",
  attachment: "flex flex-col gap-3 rounded-card border border-line bg-surface p-4",
  attachmentHeader: "flex items-center justify-between gap-3",
  attachmentTitle: shared.overline,
  attachmentLabel: "font-medium text-ink",
  error: shared.errorBox,
  // No padding on phones, so the board (which scales to fit) gets the full
  // width; the caption keeps its own inset there.
  position: "rounded-card border border-line bg-sunken p-0 pb-2 sm:p-2",
  attachmentMeta: "flex flex-col gap-1 border-b border-line px-2 pb-2 pt-2 text-xs text-ink-muted sm:px-0 sm:pt-0",
  // "Position 1 · 5-point match · 3–2 · 6-4 to play"
  caption: "text-sm text-ink",
  originLink: clsx(shared.textLink, "self-start text-xs"),
  gnuIds: "flex flex-col gap-1",
  gnuIdsSummary: "cursor-pointer select-none",
  identifier: "font-mono text-ink-muted",
  // The new-post form's read-only preview of a match decision.
  preview: "flex flex-col gap-2 rounded-card border border-line bg-sunken p-0 pb-2 sm:p-2",
  // Caps the preview board's width from sm up, so it doesn't fill the form.
  previewBoard: "w-full sm:max-w-md",
  previewCaption: "px-2 pt-2 text-sm text-ink sm:px-0 sm:pt-0",
  previewChange: "self-start px-2 sm:px-0",
  // Quiet, at the end of the attachment list, not stretched across it.
  addPosition: "self-start",
  modalHeading: shared.modalHeading,
  modalText: shared.modalText,
  modalButtons: shared.modalButtons,
  reply: "flex flex-col gap-1 border-t border-line pt-4",
} as const;
