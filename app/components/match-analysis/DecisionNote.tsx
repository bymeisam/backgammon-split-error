"use client";

import { useState } from "react";
import { NOTE_MAX_LENGTH } from "@/lib/decisionNotes";
import { useDecisionNotes, useEffectiveNote } from "@/app/providers/DecisionNotesProvider";
import { style } from "./DecisionNote.styles";

type SaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved" }
  | { kind: "error"; message: string };

// The user's personal note on one decision, shown by BoardPanel below the
// board wherever a board shows a decision.
//   - dbDecisionId missing (live path, match not in the DB): renders nothing.
//   - canEditNotes: a textarea + Save. Saving an empty note clears it.
//   - otherwise: the note read-only, or nothing when there's no note.
// canEditNotes comes from isGalaxyEnabled() on the server; the save route is
// gated by proxy.ts regardless, so this only decides what UI to offer.
// BoardPanel keys this by dbDecisionId, so the draft resets per decision.
export default function DecisionNote({
  note,
  dbDecisionId,
  canEditNotes,
}: {
  note: string | null | undefined;
  dbDecisionId: number | null | undefined;
  canEditNotes: boolean;
}) {
  const effectiveNote = useEffectiveNote({ note, dbDecisionId });
  const { recordSaved } = useDecisionNotes();
  const [draft, setDraft] = useState(effectiveNote ?? "");
  const [saveState, setSaveState] = useState<SaveState>({ kind: "idle" });

  if (dbDecisionId == null) return null;

  if (!canEditNotes) {
    if (!effectiveNote) return null;
    return (
      <div data-testid="decision-note" className={style.card}>
        <span className={style.label}>Note</span>
        <p className={style.readOnlyText}>{effectiveNote}</p>
      </div>
    );
  }

  const id = dbDecisionId;
  const unchanged = draft.trim() === (effectiveNote ?? "");

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
    } catch {
      setSaveState({ kind: "error", message: "Save failed (network error)." });
    }
  }

  return (
    <div data-testid="decision-note" className={style.card}>
      <label htmlFor={`decision-note-${id}`} className={style.label}>
        Note
      </label>
      <textarea
        id={`decision-note-${id}`}
        value={draft}
        maxLength={NOTE_MAX_LENGTH}
        placeholder="Your note on this decision…"
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
      <div className={style.footer}>
        <span className={style.status(saveState.kind === "error")} role="status">
          {saveState.kind === "saving" && "Saving…"}
          {saveState.kind === "saved" && "Saved."}
          {saveState.kind === "error" && saveState.message}
        </span>
        <button
          type="button"
          onClick={save}
          disabled={saveState.kind === "saving" || unchanged}
          className={style.saveButton}
        >
          Save
        </button>
      </div>
    </div>
  );
}
