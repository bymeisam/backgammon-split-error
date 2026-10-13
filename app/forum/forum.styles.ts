import { style as shared } from "@/lib/styles/shared.styles";

export const style = {
  list: "flex flex-col gap-3",
  stack: "flex flex-col gap-6",
  row: "flex flex-col gap-1 p-4",
  title: "font-serif text-heading text-ink",
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
  attachmentTitle: "font-serif text-title text-ink",
  attachmentLabel: "font-medium text-ink",
  error: shared.errorBox,
  // No padding on phones, so the board (which scales to fit) gets the full
  // width; the caption keeps its own inset there.
  position: "rounded-card border border-line bg-sunken p-0 pb-2 sm:p-2",
  attachmentMeta:
    "flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line px-2 pb-2 pt-2 text-xs text-ink-muted sm:px-0 sm:pt-0",
  identifier: "font-mono text-ink-muted",
  reply: "flex flex-col gap-1 border-t border-line pt-4",
} as const;
