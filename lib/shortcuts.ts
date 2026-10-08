// The "?" help's content: the keyboard shortcuts each page already has,
// written down from the existing key handlers (not changed by this file):
//   - the move-table keys (app/hooks/useMoveTableKeys.ts, mapping in
//     lib/moveTableKeys.ts) on every page with a board and a move list:
//     ↓ / j and ↑ / k the next/previous row (stopping at the ends), ← / h
//     and → / l the Played/Best tab. On the replay
//     (app/matches/[matchId]/replay/[gameIndex]/GameReplay.tsx) ↓ / ↑ step
//     through every move, crossing into the previous/next game at either
//     end, and Shift+↓ / J and Shift+↑ / K jump between mistakes. Ignored
//     while typing, with Cmd/Ctrl/Alt held, or while a dialog is open;
//   - the review session: app/review/ReviewSession.tsx, mapping in
//     lib/reviewKeys.ts (before answering: ↓ / j and ↑ / k move the focus
//     through the options, Enter or Space chooses the focused one, an
//     option's number chooses it — 1 up to the option count, at most 5
//     options on any card; after answering a move, ← / h and → / l switch
//     the board between your answer and the best move; Shift+H / Shift+G /
//     Shift+E / Enter after a right answer; Enter after a wrong one, once
//     it's saved). Same ignore rules as the move tables;
//   - the tag box: app/components/review/TagEditor.tsx (↑ / ↓ / Enter /
//     Esc), on the DB-backed boards in write mode;
//   - the move lists: app/components/match-analysis/DecisionList.tsx (each
//     row is focusable; Enter or Space selects it), on every page with a
//     board and a list.
// Letter keys are shown as keycaps (H, not h), as on the review session's
// rating buttons; the handlers take the plain (unshifted) letter, except
// the replay's mistake jump and the review ratings, shown as Shift+J etc. `alternatives`
// keys are either-or, shown "↓ / J".
// Pure, so it's unit-tested. If a handler changes, change this list too.

export interface Shortcut {
  keys: string[];
  description: string;
  // The keys are alternatives (any one of them), shown with a "/" between.
  alternatives?: boolean;
}

export interface ShortcutGroup {
  title: string;
  shortcuts: Shortcut[];
}

const REPLAY_PATH = /^\/matches\/[^/]+\/replay\/[^/]+\/?$/;
const MATCH_PATH = /^\/matches\/(?!analysis\/?$)[^/]+\/?$/;
const GALAXY_MATCH_PATH = /^\/galaxy\/matches\/[^/]+\/?$/;

function isReplay(pathname: string): boolean {
  return REPLAY_PATH.test(pathname);
}

function isReviewSession(pathname: string): boolean {
  return pathname === "/review" || pathname === "/review/";
}

// The pages whose boards carry the tag box (DecisionReviewTools, write mode
// only): /mistakes, /repeated-positions, the match page, the replay and the
// review session's back. Never /galaxy.
function hasTagBox(pathname: string): boolean {
  return (
    pathname === "/mistakes" ||
    pathname === "/repeated-positions" ||
    MATCH_PATH.test(pathname) ||
    isReplay(pathname) ||
    isReviewSession(pathname)
  );
}

const HELP_GROUP: ShortcutGroup = {
  title: "Everywhere",
  shortcuts: [
    { keys: ["?"], description: "Show or hide this help" },
    { keys: ["Esc"], description: "Close this help" },
  ],
};

const REPLAY_GROUP: ShortcutGroup = {
  title: "Replay",
  shortcuts: [
    {
      keys: ["↓", "J"],
      alternatives: true,
      description: "Next move (from the last move: the next game)",
    },
    {
      keys: ["↑", "K"],
      alternatives: true,
      description: "Previous move (from the first move: the previous game's last move)",
    },
    { keys: ["←", "H"], alternatives: true, description: "Show my move on the board" },
    { keys: ["→", "L"], alternatives: true, description: "Show the best move on the board" },
    { keys: ["Shift+↓", "Shift+J"], alternatives: true, description: "Next mistake in this game" },
    { keys: ["Shift+↑", "Shift+K"], alternatives: true, description: "Previous mistake in this game" },
  ],
};

const REVIEW_GROUP: ShortcutGroup = {
  title: "Review session",
  shortcuts: [
    { keys: ["↓", "J"], alternatives: true, description: "Next option (before answering)" },
    { keys: ["↑", "K"], alternatives: true, description: "Previous option (before answering)" },
    { keys: ["Enter", "Space"], alternatives: true, description: "Choose the highlighted option" },
    { keys: ["1", "…", "5"], description: "Choose that option by its number (before answering)" },
    { keys: ["←", "H"], alternatives: true, description: "Show your answer on the board (after answering a move)" },
    { keys: ["→", "L"], alternatives: true, description: "Show the best move on the board (after answering a move)" },
    { keys: ["Shift+H"], description: "Rate Hard (after a right answer)" },
    { keys: ["Shift+G", "Enter"], alternatives: true, description: "Rate Good (after a right answer)" },
    { keys: ["Shift+E"], description: "Rate Easy (after a right answer)" },
    { keys: ["Enter"], description: "Next card (after a wrong answer, once it's saved)" },
  ],
};

// The pages with a move list next to the board (DecisionList): /mistakes,
// /repeated-positions, the match pages (local and Galaxy) and the replay.
function hasMoveList(pathname: string): boolean {
  return (
    pathname === "/mistakes" ||
    pathname === "/repeated-positions" ||
    MATCH_PATH.test(pathname) ||
    GALAXY_MATCH_PATH.test(pathname) ||
    isReplay(pathname)
  );
}

// Focus and Enter/Space on the rows, on every move-table page.
const ROW_FOCUS_SHORTCUTS: Shortcut[] = [
  { keys: ["Tab"], description: "Move to the next row (Shift+Tab: the previous one)" },
  { keys: ["Enter", "Space"], description: "Show the focused row on the board" },
];

// The replay lists its own row and tab keys in REPLAY_GROUP above.
const MOVE_TABLE_GROUP: ShortcutGroup = {
  title: "Move table",
  shortcuts: [
    { keys: ["↓", "J"], alternatives: true, description: "Next row (stops at the last one)" },
    { keys: ["↑", "K"], alternatives: true, description: "Previous row (stops at the first one)" },
    { keys: ["←", "H"], alternatives: true, description: "Show my move on the board" },
    { keys: ["→", "L"], alternatives: true, description: "Show the best move on the board" },
    ...ROW_FOCUS_SHORTCUTS,
  ],
};

const REPLAY_MOVE_TABLE_GROUP: ShortcutGroup = {
  title: "Move table",
  shortcuts: ROW_FOCUS_SHORTCUTS,
};

const TAG_BOX_GROUP: ShortcutGroup = {
  title: "Tag box (while typing a tag)",
  shortcuts: [
    { keys: ["↑", "↓"], description: "Move through the suggestions" },
    { keys: ["Enter"], description: "Add the highlighted suggestion, or what you typed" },
    { keys: ["Esc"], description: "Close the suggestions" },
  ],
};

// The groups for a page, page-specific first. writeEnabled: the review
// session and the tag box only exist in write mode.
export function shortcutsFor(pathname: string, writeEnabled: boolean): ShortcutGroup[] {
  const groups: ShortcutGroup[] = [];
  if (isReplay(pathname)) groups.push(REPLAY_GROUP);
  if (writeEnabled && isReviewSession(pathname)) groups.push(REVIEW_GROUP);
  if (hasMoveList(pathname)) groups.push(isReplay(pathname) ? REPLAY_MOVE_TABLE_GROUP : MOVE_TABLE_GROUP);
  if (writeEnabled && hasTagBox(pathname)) groups.push(TAG_BOX_GROUP);
  groups.push(HELP_GROUP);
  return groups;
}
