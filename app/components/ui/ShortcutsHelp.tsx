"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { shortcutsFor } from "@/lib/shortcuts";
import { style } from "./AppNav.styles";

function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable)
  );
}

// "?" (outside a text field) opens a list of the current page's keyboard
// shortcuts (lib/shortcuts.ts, written down from the existing handlers,
// which this doesn't touch). Also opened by the navbar's "?" button.
export default function ShortcutsHelp({ writeEnabled }: { writeEnabled: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "?" || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      e.preventDefault();
      setOpen(true);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (open) closeRef.current?.focus();
  }, [open]);

  const groups = shortcutsFor(pathname, writeEnabled);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Keyboard shortcuts"
        title="Keyboard shortcuts (?)"
        className={style.helpButton}
      >
        ?
      </button>
      {open && (
        <div
          className={style.modalOverlay}
          onClick={() => setOpen(false)}
          // Keys pressed while the help is open stay here: they never reach
          // the page's own window-level handlers (the review session's
          // Enter, the replay's arrows), the same way TagEditor's input
          // keeps them.
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Escape" || e.key === "?") {
              e.preventDefault();
              setOpen(false);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="shortcuts-help-title"
            data-testid="shortcuts-help"
            // Focusable, so a click inside the panel keeps the focus (and
            // the keys) inside the dialog.
            tabIndex={-1}
            className={style.modalPanel}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="shortcuts-help-title" className={style.modalHeading}>
              Keyboard shortcuts
            </h2>
            <div className={style.helpGroups}>
              {groups.map((group) => (
                <section key={group.title}>
                  <h3 className={style.helpGroupTitle}>{group.title}</h3>
                  {group.shortcuts.map((s) => (
                    <div key={`${s.keys.join("+")}-${s.description}`} className={style.helpRow}>
                      <span className={style.helpKeys}>
                        {s.keys.map((k, i) => (
                          <kbd key={`${i}-${k}`} className={style.kbd}>
                            {k}
                          </kbd>
                        ))}
                      </span>
                      <span>{s.description}</span>
                    </div>
                  ))}
                </section>
              ))}
            </div>
            <div className={style.modalButtons}>
              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpen(false)}
                className={style.modalSecondaryButton}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
