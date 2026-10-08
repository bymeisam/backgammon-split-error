// The move-table keys (arrow keys plus vim keys) on the pages with a board
// and a move list: /mistakes, /repeated-positions, the match pages (local
// and Galaxy) and the replay. Never /review, whose own keys (H/G/E and the
// numbers) stay as they are: the hook (app/hooks/useMoveTableKeys.ts) is
// only used by the move-table components, never by ReviewSession.
//
// Pure, so it's unit-tested (lib/moveTableKeys.test.ts). The "?" help lists
// these keys (lib/shortcuts.ts); change both together.

export type MoveTablePage = "list" | "replay";

export type MoveTableAction =
  | "next" // the next row (the replay: the next step, crossing into the next game)
  | "prev" // the previous row (the replay: the previous step, crossing back)
  | "my" // the Played tab (My move)
  | "best" // the Best tab (Best move)
  | "nextMistake" // the replay only: the next listed mistake
  | "prevMistake"; // the replay only: the previous listed mistake

// The action for a key on a page type, or null when the key isn't one of
// ours there (the caller then leaves the event alone, so the browser keeps
// it). Letters by their `key` value: "j" is the plain key, "J" the shifted
// one (Shift+j, or Caps Lock), which on the replay jumps between mistakes.
// The arrows use the Shift flag. Shift+←/→, Shift+H/L and, outside the
// replay, Shift+↑/↓ and J/K aren't ours.
export function moveTableAction(key: string, shift: boolean, page: MoveTablePage): MoveTableAction | null {
  switch (key) {
    case "ArrowDown":
      return shift ? (page === "replay" ? "nextMistake" : null) : "next";
    case "ArrowUp":
      return shift ? (page === "replay" ? "prevMistake" : null) : "prev";
    case "ArrowLeft":
      return shift ? null : "my";
    case "ArrowRight":
      return shift ? null : "best";
    case "j":
      return "next";
    case "k":
      return "prev";
    case "h":
      return "my";
    case "l":
      return "best";
    case "J":
      return page === "replay" ? "nextMistake" : null;
    case "K":
      return page === "replay" ? "prevMistake" : null;
    default:
      return null;
  }
}

// Inputs that take no typing: a focused checkbox (the match page's tick
// boxes, the replay's "Fixed perspective") or button-like input doesn't
// swallow the keys, so ticking a row doesn't switch them off until the
// focus moves. Every other input (text, number, search, radio…) does.
const NON_TYPING_INPUT_TYPES = new Set(["checkbox", "button", "submit", "reset", "image"]);

export interface KeyTarget {
  tagName: string;
  isContentEditable?: boolean;
  type?: string;
}

// Whether the focus is somewhere that takes the keys itself: a text input,
// a textarea (the note editor), a select (the filters, the Game select) or
// a contenteditable.
export function isEditableTarget(target: KeyTarget | null): boolean {
  if (!target) return false;
  const tag = target.tagName.toUpperCase();
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag === "INPUT") return !NON_TYPING_INPUT_TYPES.has((target.type ?? "text").toLowerCase());
  return target.isContentEditable === true;
}

export interface KeyEventLike {
  target: KeyTarget | null;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  isComposing?: boolean;
  defaultPrevented?: boolean;
}

// The ignore rules: typing in a field, any modifier but Shift (Cmd, Ctrl or
// Alt: the browser's), an IME composition, an event something else already
// handled, or a <dialog> open (the "?" help, a bulk-add confirm).
export function shouldIgnoreKey(e: KeyEventLike, dialogOpen: boolean): boolean {
  return (
    dialogOpen ||
    e.metaKey ||
    e.ctrlKey ||
    e.altKey ||
    e.isComposing === true ||
    e.defaultPrevented === true ||
    isEditableTarget(e.target)
  );
}

// The next (+1) or previous (-1) index in a list of `length` rows, stopping
// at the ends: null when there's nowhere to go. A current index of -1 (no
// row resolved) goes to the first row either way.
export function stepIndex(current: number, length: number, direction: 1 | -1): number | null {
  if (length === 0) return null;
  if (current < 0 || current >= length) return 0;
  const next = current + direction;
  return next < 0 || next >= length ? null : next;
}

// The replay's mistake jump: the nearest index after (+1) or before (-1)
// `current` whose row is a listed mistake, or null when there's none that
// way (it stops; it doesn't cross into another game).
export function findMistakeIndex<T>(
  rows: readonly T[],
  current: number,
  direction: 1 | -1,
  isMistake: (row: T) => boolean
): number | null {
  for (let i = current + direction; i >= 0 && i < rows.length; i += direction) {
    if (isMistake(rows[i])) return i;
  }
  return null;
}
