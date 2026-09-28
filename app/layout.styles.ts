import clsx from "clsx";

// Page-local (see .claude/skills/styling-conventions) — covers RootLayout,
// the only component defined in this file.
export const style = {
  // Function, 2 params -> passed directly. geistSansVariable/geistMonoVariable
  // are runtime-computed CSS variable names from next/font (not literal
  // Tailwind classes to hardcode here), so they stay as parameters — the
  // original always concatenated both plus 2 static classes, no branching,
  // so this isn't a true conditional, but clsx joins it identically and
  // keeps the same "compose in the styles file" convention every other
  // dynamic className in this codebase already follows.
  html: (geistSansVariable: string, geistMonoVariable: string): string =>
    clsx(geistSansVariable, geistMonoVariable, "h-full antialiased"),
  body: "min-h-full flex flex-col",
} as const;
