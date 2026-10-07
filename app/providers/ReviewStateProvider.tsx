"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { DecisionReviewStatus, DecisionTagRef } from "@/lib/review/types";

// Review cards and tags changed in this browser tab since the page's data
// was loaded, keyed by the real Decision.id — same reason as
// DecisionNotesProvider: decisions arrive as props that don't change when
// one is added to review or tagged, so without this the change would vanish
// when another decision is selected and this one reselected. A recorded
// value always wins over the prop. Also caches the tag list for the tag
// editor's autocomplete (fetched once per tab, refreshed after a new tag).
interface ReviewStateValue {
  savedCards: ReadonlyMap<number, DecisionReviewStatus | null>;
  savedTags: ReadonlyMap<number, DecisionTagRef[]>;
  recordCard: (dbDecisionId: number, card: DecisionReviewStatus | null) => void;
  recordTags: (dbDecisionId: number, tags: DecisionTagRef[]) => void;
  allTags: DecisionTagRef[] | null;
  loadAllTags: (force?: boolean) => void;
}

const ReviewStateContext = createContext<ReviewStateValue | undefined>(undefined);

export function ReviewStateProvider({ children }: { children: ReactNode }) {
  const [savedCards, setSavedCards] = useState<ReadonlyMap<number, DecisionReviewStatus | null>>(() => new Map());
  const [savedTags, setSavedTags] = useState<ReadonlyMap<number, DecisionTagRef[]>>(() => new Map());
  const [allTags, setAllTags] = useState<DecisionTagRef[] | null>(null);
  const [loading, setLoading] = useState(false);

  const recordCard = useCallback((id: number, card: DecisionReviewStatus | null) => {
    setSavedCards((prev) => new Map(prev).set(id, card));
  }, []);
  const recordTags = useCallback((id: number, tags: DecisionTagRef[]) => {
    setSavedTags((prev) => new Map(prev).set(id, tags));
  }, []);

  const loadAllTags = useCallback(
    (force = false) => {
      if (loading || (allTags !== null && !force)) return;
      setLoading(true);
      fetch("/api/tags")
        .then((res) => (res.ok ? res.json() : null))
        .then((json: { tags?: DecisionTagRef[] } | null) => {
          if (json?.tags) setAllTags(json.tags.map((t) => ({ id: t.id, name: t.name })));
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    },
    [allTags, loading]
  );

  const value = useMemo(
    () => ({ savedCards, savedTags, recordCard, recordTags, allTags, loadAllTags }),
    [savedCards, savedTags, recordCard, recordTags, allTags, loadAllTags]
  );
  return <ReviewStateContext.Provider value={value}>{children}</ReviewStateContext.Provider>;
}

export function useReviewState(): ReviewStateValue {
  const ctx = useContext(ReviewStateContext);
  if (!ctx) throw new Error("useReviewState must be used within a ReviewStateProvider.");
  return ctx;
}

// This tab's recorded card for a decision if any, otherwise the prop's.
export function useEffectiveReviewCard(decision: {
  dbDecisionId?: number | null;
  reviewCard?: DecisionReviewStatus | null;
}): DecisionReviewStatus | null {
  const { savedCards } = useReviewState();
  const id = decision.dbDecisionId;
  if (id != null && savedCards.has(id)) return savedCards.get(id) ?? null;
  return decision.reviewCard ?? null;
}

export function useEffectiveTags(decision: { dbDecisionId?: number | null; tags?: DecisionTagRef[] }): DecisionTagRef[] {
  const { savedTags } = useReviewState();
  const id = decision.dbDecisionId;
  if (id != null && savedTags.has(id)) return savedTags.get(id) ?? [];
  return decision.tags ?? [];
}
