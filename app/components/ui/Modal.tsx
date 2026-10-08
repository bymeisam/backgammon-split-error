"use client";

import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import { style } from "./Modal.styles";

// A modal on the native <dialog>, opened with showModal(): the browser puts
// it in the top layer, so it escapes any containing block (the sticky
// navbar's backdrop-filter made a position:fixed overlay inside it take the
// bar's box), and it traps focus and closes on Esc by itself. Used by the
// "?" help, /mistakes' "Add all to review", /review/cards' delete
// confirmation and /galaxy/matches' TokenModal.
//
// Keys pressed inside never reach the page's own window-level handlers (the
// review session's Enter, the replay's arrows): React's stopPropagation runs
// at the root, before window. `dismissible` false (TokenModal) ignores Esc
// and backdrop clicks, and reopens if the browser closes it anyway.
export default function Modal({
  open,
  onClose,
  labelledBy,
  dismissible = true,
  initialFocusRef,
  onKeyDown,
  testId,
  children,
}: {
  open: boolean;
  onClose?: () => void;
  labelledBy: string;
  dismissible?: boolean;
  // Focused after opening; otherwise the browser focuses the first
  // focusable element.
  initialFocusRef?: RefObject<HTMLElement | null>;
  onKeyDown?: (e: React.KeyboardEvent<HTMLDialogElement>) => void;
  testId?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      initialFocusRef?.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open, initialFocusRef]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      data-testid={testId}
      className={style.dialog}
      onCancel={(e) => {
        e.preventDefault();
        if (dismissible) onClose?.();
      }}
      onClose={() => {
        // Closed by the browser while it should stay open: show it again.
        if (open && !dismissible) ref.current?.showModal();
      }}
      // A click on the backdrop lands on the <dialog> itself; the panel
      // fills it otherwise.
      onClick={(e) => {
        if (e.target === e.currentTarget && dismissible) onClose?.();
      }}
      onKeyDown={(e) => {
        e.stopPropagation();
        onKeyDown?.(e);
      }}
    >
      {open && <div className={style.panel}>{children}</div>}
    </dialog>
  );
}
