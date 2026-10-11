export const style = {
  page: "flex min-h-screen items-center justify-center bg-paper px-6 py-12 text-ink",
  shell: "w-full max-w-[420px]",
  brand: "mb-8 flex flex-col items-center text-center",
  mark: "mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-line-strong bg-surface shadow-card",
  markBack: "h-5 w-5 rounded-full border-2 border-accent",
  markFront: "-ml-3 h-5 w-5 rounded-full border-2 border-ink-muted bg-surface",
  brandName: "font-serif text-2xl font-medium text-ink",
  tagline: "mt-2 max-w-xs text-sm leading-6 text-ink-muted",
  card: "rounded-card border border-line bg-surface p-2 shadow-card",
  note: "mt-5 text-center text-xs leading-5 text-ink-faint",
} as const;
