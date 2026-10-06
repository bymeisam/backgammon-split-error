"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

// Notes saved in this browser tab since the page's data was loaded, keyed by
// the real Decision.id (null = cleared). Decisions arrive as props from
// server-rendered or fetched data that doesn't change when a note is saved,
// so without this a saved note would vanish from the board (and its list-row
// dot) as soon as another decision was selected and this one re-selected.
// A saved value always wins over the prop: it's the latest thing written.
interface DecisionNotesValue {
  savedNotes: ReadonlyMap<number, string | null>;
  recordSaved: (dbDecisionId: number, note: string | null) => void;
}

const DecisionNotesContext = createContext<DecisionNotesValue | undefined>(undefined);

export function DecisionNotesProvider({ children }: { children: ReactNode }) {
  const [savedNotes, setSavedNotes] = useState<ReadonlyMap<number, string | null>>(() => new Map());

  const recordSaved = useCallback((dbDecisionId: number, note: string | null) => {
    setSavedNotes((prev) => new Map(prev).set(dbDecisionId, note));
  }, []);

  const value = useMemo(() => ({ savedNotes, recordSaved }), [savedNotes, recordSaved]);

  return <DecisionNotesContext.Provider value={value}>{children}</DecisionNotesContext.Provider>;
}

export function useDecisionNotes(): DecisionNotesValue {
  const ctx = useContext(DecisionNotesContext);
  if (!ctx) {
    throw new Error("useDecisionNotes must be used within a DecisionNotesProvider.");
  }
  return ctx;
}

// The note to show for one decision: this tab's saved value if there is
// one, otherwise whatever the decision arrived with.
export function useEffectiveNote(decision: {
  note?: string | null;
  dbDecisionId?: number | null;
}): string | null {
  const { savedNotes } = useDecisionNotes();
  const id = decision.dbDecisionId;
  if (id != null && savedNotes.has(id)) return savedNotes.get(id) ?? null;
  return decision.note ?? null;
}
