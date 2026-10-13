// /review keyboard contract; tests live in reviewKeys.test.ts and the "?"
// help is lib/shortcuts.ts. Keep both references in sync with this state machine.
//
// On the front, 1–9 choose an option; ↓ / ↑ or j / k move focus. A retry
// front keeps the first wrong choice visible but excludes it from selection.
// A noted correct choice enters the reason step: Y / Enter means yes; N means no.
// On the back, ← / h and → / l switch board tabs. Enter advances only after
// a save for wrong answers and Hard-only successes; with unlimited or
// Hard/Good ratings, Enter rates Good.
// H / G / E rate Hard / Good / Easy. Ratings are read from `key`, so Shift
// is required: Shift+H/G/E. A second-try correct answer is Hard-only; a
// correct answer after "No" is Hard/Good. Wrong answers save Again.
//
// The caller ignores typing, dialogs, and Cmd/Ctrl/Alt via shouldIgnoreKey.
// Rating limits and save state prevent unavailable ratings, duplicate saves,
// or advancing before the final save.

import type { MoveTab } from "./listSelection";

export type Rating = "hard" | "good" | "easy";

export type ReviewKeyAction =
  | { type: "moveFocus"; direction: 1 | -1 }
  | { type: "choose"; index: number }
  | { type: "tab"; tab: MoveTab }
  | { type: "rate"; rating: Rating }
  | { type: "reason"; knows: boolean }
  | { type: "next" };

export type ReviewKeyContext =
  | { side: "front"; optionCount: number; excludedIndex?: number }
  | { side: "reason" }
  | { side: "back"; correct: boolean; saveKind: "idle" | "saving" | "saved" | "error"; hasTabs: boolean; ratingLimit?: "hard" | "hard-good" };

// The action for a key, or null when it isn't one of ours in this state
// (the caller then leaves the event alone).
export function reviewKeyAction(key: string, shift: boolean, ctx: ReviewKeyContext): ReviewKeyAction | null {
  if (ctx.side === "reason") {
    if (key === "y" || key === "Y" || key === "Enter") return { type: "reason", knows: true };
    if (key === "n" || key === "N") return { type: "reason", knows: false };
    return null;
  }
  if (ctx.side === "front") {
    if ((key === "ArrowDown" && !shift) || key === "j") return { type: "moveFocus", direction: 1 };
    if ((key === "ArrowUp" && !shift) || key === "k") return { type: "moveFocus", direction: -1 };
    const n = Number(key);
    const index = n - 1;
    if (/^[1-9]$/.test(key) && n <= ctx.optionCount && index !== ctx.excludedIndex) return { type: "choose", index };
    return null;
  }

  if (ctx.hasTabs) {
    if ((key === "ArrowLeft" && !shift) || key === "h") return { type: "tab", tab: "my" };
    if ((key === "ArrowRight" && !shift) || key === "l") return { type: "tab", tab: "best" };
  }
  if (!ctx.correct) {
    return key === "Enter" && ctx.saveKind === "saved" ? { type: "next" } : null;
  }
  if (ctx.saveKind === "saving") return null;
  if (ctx.ratingLimit === "hard") {
    if (key === "Enter" && ctx.saveKind === "saved") return { type: "next" };
    return key === "H" ? { type: "rate", rating: "hard" } : null;
  }
  if (key === "H") return { type: "rate", rating: "hard" };
  if (ctx.ratingLimit === "hard-good") return key === "G" || key === "Enter" ? { type: "rate", rating: "good" } : null;
  if (key === "G" || key === "Enter") return { type: "rate", rating: "good" };
  if (key === "E") return { type: "rate", rating: "easy" };
  return null;
}
