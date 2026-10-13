// The /review session's pure keyboard contract; tests live in reviewKeys.test.ts.

// Front navigation/selection applies before answering and on a retry. Excluded
// indices remain visible but cannot be chosen on the retry.
// Back ratings are constrained by ratingLimit for note-aware outcomes.

// Plain h / g / e no longer rate (since 2026-10-09). The rating letters are
// read by their `key` value, "H" (Shift+h, or Caps Lock), like the
// replay's J / K.
//
// Pure, so it's unit-tested (lib/reviewKeys.test.ts). The "?" help lists
// these keys (lib/shortcuts.ts); change both together. The ignore rules
// (typing, a dialog, Cmd/Ctrl/Alt) are moveTableKeys.ts's shouldIgnoreKey.

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
