"use client";

import { useState, type ReactNode } from "react";
import { NOTE_MAX_LENGTH } from "@/lib/decisionNotes";
import { useDecisionNotes, useEffectiveNote } from "@/app/providers/DecisionNotesProvider";
import { style } from "./DecisionNote.styles";

type SaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved" }
  | { kind: "error"; message: string };

// The note card: the user's personal note on one decision, with the
// decision's tags in its foot and an optional action in its head ("Add to
// review"). Shown below the board (via DecisionReviewTools) and on the back
// of a review card.
//   - dbDecisionId missing (live path, match not in the DB): renders nothing.
//   - canEditNotes: a textarea + "Save note". Saving an empty note clears it.
//     With `toggle` (the review back), the note shows as text with an "Edit
//     note"/"Write note" button that swaps in the textarea.
//   - otherwise: the note read-only; nothing at all when there's no note and
//     no tags (`hasTags`).
// canEditNotes comes from isGalaxyEnabled() on the server; the save route is
// gated by proxy.ts regardless, so this only decides what UI to offer.
// Callers key this by dbDecisionId, so the draft resets per decision.
export default function DecisionNote({
  note,
  dbDecisionId,
  canEditNotes,
  headAction,
  tags,
  hasTags = false,
  placeholder = "Your note on this decision…",
  toggle,
  inset = false,
}: {
  note: string | null | undefined;
  dbDecisionId: number | null | undefined;
  canEditNotes: boolean;
  headAction?: ReactNode;
  tags?: ReactNode;
  hasTags?: boolean;
  placeholder?: string;
  // The review back's view/edit toggle; `emptyText` is the prompt shown
  // when there's no note yet.
  toggle?: { emptyText: string };
  // Inset from the screen edge below md (a page without side padding there).
  inset?: boolean;
}) {
  const effectiveNote = useEffectiveNote({ note, dbDecisionId });
  const { recordSaved } = useDecisionNotes();
  const [draft, setDraft] = useState(effectiveNote ?? "");
  const [saveState, setSaveState] = useState<SaveState>({ kind: "idle" });
  const [editing, setEditing] = useState(false);

  if (dbDecisionId == null) return null;
  if (!canEditNotes && !effectiveNote && !hasTags) return null;

  const id = dbDecisionId;
  const unchanged = draft.trim() === (effectiveNote ?? "");
  const showEditor = canEditNotes && (!toggle || editing);

  async function save() {
    setSaveState({ kind: "saving" });
    try {
      const res = await fetch(`/api/decisions/${id}/note`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: draft }),
      });
      const json = (await res.json().catch(() => null)) as { note?: string | null; error?: string } | null;
      if (!res.ok) {
        setSaveState({ kind: "error", message: json?.error ?? `Save failed (HTTP ${res.status}).` });
        return;
      }
      const saved = json?.note ?? null;
      recordSaved(id, saved);
      setDraft(saved ?? "");
      setSaveState({ kind: "saved" });
      setEditing(false);
    } catch {
      setSaveState({ kind: "error", message: "Save failed (network error)." });
    }
  }

  return (
    <div
      data-testid="decision-note"
      className={style.card(Boolean(toggle), inset)}
      // Enter or Space on one of the card's buttons activates that button
      // only; it doesn't also reach the page's window-level keys (the review
      // session's Enter = Good).
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && e.target instanceof HTMLButtonElement) e.stopPropagation();
      }}
    >
      <div className={style.head}>
        {showEditor ? (
          <label htmlFor={`decision-note-${id}`} className={style.label}>
            Your note
          </label>
        ) : (
          <span className={style.label}>Your note</span>
        )}
        {headAction}
      </div>

      {showEditor ? (
        <textarea
          id={`decision-note-${id}`}
          value={draft}
          maxLength={NOTE_MAX_LENGTH}
          placeholder={placeholder}
          onChange={(e) => {
            setDraft(e.target.value);
            if (saveState.kind !== "saving") setSaveState({ kind: "idle" });
          }}
          // Keep typing (arrow keys especially) from reaching page-level
          // keyboard shortcuts, e.g. GameReplay's ←/→ decision stepping,
          // which listens on window.
          onKeyDown={(e) => e.stopPropagation()}
          className={style.textarea}
        />
      ) : effectiveNote ? (
        <p className={style.readOnlyText}>{effectiveNote}</p>
      ) : toggle ? (
        <p className={style.emptyText}>{toggle.emptyText}</p>
      ) : null}

      <div className={style.foot}>
        <div className={style.tags}>{tags}</div>
        <div className={style.footEnd}>
          {saveState.kind !== "idle" && (
            <span className={style.status(saveState.kind === "error")} role="status">
              {saveState.kind === "saving" && "Saving…"}
              {saveState.kind === "saved" && "Saved."}
              {saveState.kind === "error" && saveState.message}
            </span>
          )}
          {showEditor ? (
            <button
              type="button"
              onClick={save}
              disabled={saveState.kind === "saving" || unchanged}
              className={style.saveButton}
            >
              Save note
            </button>
          ) : canEditNotes && toggle ? (
            <button type="button" onClick={() => setEditing(true)} className={style.editButton}>
              {effectiveNote ? "Edit note" : "Write note"}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
