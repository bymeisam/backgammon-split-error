// The /review session's keys (app/review/ReviewSession.tsx), with the same
// movement keys as the move tables (lib/moveTableKeys.ts):
//
// Front (before answering):
//   ↓ / j, ↑ / k  move the focus through the answer options (Enter or Space
//                 on the focused option chooses it: the button's own
//                 behaviour, not this mapping);
//   1 … n         choose that option directly.
// Back (after answering):
//   ← / h, → / l  show your answer / the best move on the board (checker
//                 cards, which have the Yours / Best tabs; cube cards have
//                 no arrows, so the keys aren't taken there);
//   Shift+H / Shift+G / Shift+E  rate Hard / Good / Easy (a right answer,
//                 not while saving); Enter rates Good too;
//   Enter         next card (a wrong answer, once it's saved as Again).
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
  | { type: "next" };

export type ReviewKeyContext =
  | { side: "front"; optionCount: number }
  | { side: "back"; correct: boolean; saveKind: "idle" | "saving" | "saved" | "error"; hasTabs: boolean };

// The action for a key, or null when it isn't one of ours in this state
// (the caller then leaves the event alone).
export function reviewKeyAction(key: string, shift: boolean, ctx: ReviewKeyContext): ReviewKeyAction | null {
  if (ctx.side === "front") {
    if ((key === "ArrowDown" && !shift) || key === "j") return { type: "moveFocus", direction: 1 };
    if ((key === "ArrowUp" && !shift) || key === "k") return { type: "moveFocus", direction: -1 };
    const n = Number(key);
    if (/^[1-9]$/.test(key) && n <= ctx.optionCount) return { type: "choose", index: n - 1 };
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
  if (key === "H") return { type: "rate", rating: "hard" };
  if (key === "G" || key === "Enter") return { type: "rate", rating: "good" };
  if (key === "E") return { type: "rate", rating: "easy" };
  return null;
}
