export const style = {
  page: "flex min-h-screen items-center justify-center bg-paper px-6 py-12 text-ink",
  shell: "w-full min-w-0 max-w-[420px]",
  brand: "mb-8 flex flex-col items-center text-center",
  mark: "mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-line-strong bg-surface shadow-card",
  markBack: "h-5 w-5 rounded-full border-2 border-accent",
  markFront: "-ml-3 h-5 w-5 rounded-full border-2 border-ink-muted bg-surface",
  brandName: "font-serif text-2xl font-medium text-ink",
  tagline: "mt-2 max-w-xs text-sm leading-6 text-ink-muted",
  note: "mt-5 text-center text-xs leading-5 text-ink-faint",
  // Clerk's own card is the only frame (no wrapper card around it), dressed
  // in the app's tokens through its `appearance.elements` class hooks. Only
  // `elements`: Clerk's `variables` are parsed by its UI bundle, loaded from
  // Clerk's CDN, so whether they accept CSS variables can't be checked here.
  // Clerk's own styles are injected after ours with higher specificity, so
  // the overrides are important (`!`); layout-only classes don't need it.
  clerk: {
    rootBox: "w-full",
    cardBox: "w-full! max-w-full! rounded-card! border! border-line! shadow-card!",
    card: "bg-surface!",
    headerTitle: "font-serif! text-ink!",
    formButtonPrimary: "bg-primary! bg-none! text-on-primary! shadow-none! hover:bg-primary/86!",
  },
} as const;
