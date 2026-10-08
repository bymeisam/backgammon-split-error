import { useEffect, useRef } from "react";
import { moveTableAction, shouldIgnoreKey, type MoveTableAction, type MoveTablePage } from "@/lib/moveTableKeys";

// The shared ignore rules (lib/moveTableKeys.ts's shouldIgnoreKey) for a
// real window keydown: typing in a field, Cmd/Ctrl/Alt held, an IME
// composition, an event already handled, or a <dialog> open. Also used by
// the review session's own key handler (app/review/ReviewSession.tsx).
export function isIgnoredKeyEvent(e: KeyboardEvent): boolean {
  const target = e.target instanceof HTMLElement ? e.target : null;
  return shouldIgnoreKey(
    {
      target: target
        ? {
            tagName: target.tagName,
            isContentEditable: target.isContentEditable,
            type: target instanceof HTMLInputElement ? target.type : undefined,
          }
        : null,
      metaKey: e.metaKey,
      ctrlKey: e.ctrlKey,
      altKey: e.altKey,
      isComposing: e.isComposing,
      defaultPrevented: e.defaultPrevented,
    },
    document.querySelector("dialog[open]") !== null
  );
}

// The move-table keys, page-level (a window listener, so they work without
// the table having focus): ↓/j and ↑/k pick the next/previous row, ←/h and
// →/l switch the board between the Played and Best tabs, and on the replay
// Shift+↓/J and Shift+↑/K jump between mistakes. The mapping and the ignore
// rules are lib/moveTableKeys.ts (pure, unit-tested).
//
// `onAction` gets every mapped action and returns whether it did anything.
// Only then is the key's default (scrolling the page) prevented: a key that
// does nothing (↓ on the last row, ← on a page without tabs) is left to
// the browser. The latest `onAction` is always used.
export function useMoveTableKeys(page: MoveTablePage, onAction: (action: MoveTableAction) => boolean): void {
  const onActionRef = useRef(onAction);
  useEffect(() => {
    onActionRef.current = onAction;
  });

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (isIgnoredKeyEvent(e)) return;
      const action = moveTableAction(e.key, e.shiftKey, page);
      if (action && onActionRef.current(action)) e.preventDefault();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [page]);
}
