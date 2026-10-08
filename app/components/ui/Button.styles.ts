import clsx from "clsx";
import { style as shared } from "@/lib/styles/shared.styles";

// primary: the one main action in a view (Start review, Connect, a modal's
// confirm). secondary: every other action (Apply, Prev/Next, Cancel).
// quiet: an underlined text action (back links, Manage cards, Edit note).
export type ButtonVariant = "primary" | "secondary" | "quiet";

// md: page-level (38px). compact: inside a card (34px: the note card, the
// replay's controls). small: table-row actions and the navbar (28px).
// For quiet, the size is the text size: md 13px, compact 12.5px, small 12px.
export type ButtonSize = "md" | "compact" | "small";

// Every look is an existing shared primitive, so a Button looks exactly
// like the hand-written button it replaces.
const BUTTON_CLASSES = {
  primary: { md: shared.buttonPrimary, compact: shared.buttonCompactPrimary, small: shared.buttonSmallPrimary },
  secondary: { md: shared.buttonSecondary, compact: shared.buttonCompact, small: shared.buttonSmall },
  quiet: { md: shared.textLink, compact: shared.textButton, small: clsx(shared.textLink, "text-xs") },
} as const satisfies Record<ButtonVariant, Record<ButtonSize, string>>;

// Shared/promoted component (see .claude/skills/styling-conventions) —
// covers Button.tsx.
export const style = {
  // Function, 3 params -> one options object. `className` is the caller's
  // own extra classes (from its own styles file), added on top.
  button: (opts: { variant: ButtonVariant; size: ButtonSize; className?: string }): string =>
    clsx(BUTTON_CLASSES[opts.variant][opts.size], opts.className),
} as const;
