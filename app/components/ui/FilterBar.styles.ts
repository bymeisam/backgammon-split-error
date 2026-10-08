import clsx from "clsx";
import { style as shared } from "@/lib/styles/shared.styles";

// Shared/promoted component (see .claude/skills/styling-conventions) —
// covers FilterBar.tsx. The disclosure and the selects have their own
// styles (FilterDisclosure.styles.ts, FilterSelect.styles.ts).
export const style = {
  // Function, 1 param -> passed directly. No box: a row of labelled
  // controls, plus the caller's own extra classes.
  form: (className: string | undefined): string => clsx(shared.filterBar, className),
} as const;
