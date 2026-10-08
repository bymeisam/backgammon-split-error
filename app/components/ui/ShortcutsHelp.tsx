"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { shortcutsFor } from "@/lib/shortcuts";
import Modal from "./Modal";
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
      {/* A native <dialog> (Modal): the top layer, outside the navbar's
          backdrop-filter containing block. Keys pressed while it's open
          stay in it (Modal stops them), so they never reach the page's own
          window-level handlers (the review session's Enter, the replay's
          arrows); "?" closes it again. */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        labelledBy="shortcuts-help-title"
        initialFocusRef={closeRef}
        testId="shortcuts-help"
        onKeyDown={(e) => {
          if (e.key === "?") {
            e.preventDefault();
            setOpen(false);
          }
        }}
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
          <button ref={closeRef} type="button" onClick={() => setOpen(false)} className={style.modalSecondaryButton}>
            Close
          </button>
        </div>
      </Modal>
    </>
  );
}
