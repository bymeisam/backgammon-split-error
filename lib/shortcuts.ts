// The "?" help's content: the keyboard shortcuts each page already has,
// written down from the existing key handlers (not changed by this file):
//   - the replay: app/matches/[matchId]/replay/[gameIndex]/GameReplay.tsx
//     (← / →, crossing into the previous/next game at either end);
//   - the review session: app/review/ReviewSession.tsx (an option's number
//     before answering — the handler takes 1 up to the option count, at
//     most 5 options on any card; h / g / e / Enter after a right answer; Enter after a
//     wrong one, once it's saved). Ignored while typing in a text field;
//   - the tag box: app/components/review/TagEditor.tsx (↑ / ↓ / Enter /
//     Esc), on the DB-backed boards in write mode;
//   - the move lists: app/components/match-analysis/DecisionList.tsx (each
//     row is focusable; Enter or Space selects it), on every page with a
//     board and a list.
// Letter keys are shown as keycaps (H, not h), as on the review session's
// rating buttons; the handlers take the plain (unshifted) letter.
// Pure, so it's unit-tested. If a handler changes, change this list too.

export interface Shortcut {
  keys: string[];
  description: string;
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
    { keys: ["←"], description: "Previous step (from the first step: the previous game's last step)" },
    { keys: ["→"], description: "Next step (from the last step: the next game)" },
  ],
};

const REVIEW_GROUP: ShortcutGroup = {
  title: "Review session",
  shortcuts: [
    { keys: ["1", "…", "5"], description: "Choose that option by its number (before answering)" },
    { keys: ["H"], description: "Rate Hard (after a right answer)" },
    { keys: ["G", "Enter"], description: "Rate Good (after a right answer)" },
    { keys: ["E"], description: "Rate Easy (after a right answer)" },
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

const MOVE_LIST_GROUP: ShortcutGroup = {
  title: "Move list",
  shortcuts: [
    { keys: ["Tab"], description: "Move to the next row (Shift+Tab: the previous one)" },
    { keys: ["Enter", "Space"], description: "Show the focused row on the board" },
  ],
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
  if (hasMoveList(pathname)) groups.push(MOVE_LIST_GROUP);
  if (writeEnabled && hasTagBox(pathname)) groups.push(TAG_BOX_GROUP);
  groups.push(HELP_GROUP);
  return groups;
}
