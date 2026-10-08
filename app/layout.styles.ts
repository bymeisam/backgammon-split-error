import clsx from "clsx";

// Page-local (see .claude/skills/styling-conventions) — covers RootLayout,
// the only component defined in this file.
export const style = {
  // Function, 1 param -> passed directly. The next/font variable classes
  // (runtime-computed names, so they come in as a parameter) plus the
  // static classes. The fonts themselves are wired to Tailwind's font-sans/
  // font-serif/font-mono through the theme files (app/themes/*.css).
  html: (fontVariables: string[]): string => clsx(fontVariables, "h-full antialiased"),
  body: "min-h-full flex flex-col bg-paper text-ink",
} as const;
