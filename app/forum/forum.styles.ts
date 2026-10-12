export const style = {
  stack: "flex flex-col gap-6",
  row: "flex flex-col gap-1 p-4",
  title: "font-serif text-heading text-ink",
  meta: "text-sm text-ink-muted",
  body: "whitespace-pre-wrap text-ink",
  form: "flex flex-col gap-4",
  input: "w-full rounded-control border border-line-strong bg-surface px-3 py-2 text-ink outline-focus",
  actions: "flex flex-wrap gap-3",
  error: "rounded-control border border-error/40 bg-error-tint px-3 py-2 text-sm text-error-ink",
  position: "overflow-x-auto rounded-card border border-line bg-sunken p-2",
  reply: "flex flex-col gap-1 border-t border-line pt-4",
} as const;
