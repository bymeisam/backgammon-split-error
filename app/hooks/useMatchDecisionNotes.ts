import { useEffect, useState } from "react";
import type { MatchDecisionNotesResponse } from "@/lib/decisionNotes";

const EMPTY: MatchDecisionNotesResponse = { canEdit: false, decisions: [] };

// The live path's notes for one match (GET /api/decision-notes), fetched
// once per matchId — one DB query per match, not per decision. Stays empty
// (no notes, not editable) until loaded, and if the request fails: non-fatal
// for MistakesSection, which then simply shows no note UI.
export function useMatchDecisionNotes(matchId: string | undefined): MatchDecisionNotesResponse {
  const [result, setResult] = useState<{ matchId: string; data: MatchDecisionNotesResponse } | null>(null);

  useEffect(() => {
    if (!matchId) return;
    let cancelled = false;
    fetch(`/api/decision-notes?matchId=${encodeURIComponent(matchId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!cancelled && json) setResult({ matchId, data: json as MatchDecisionNotesResponse });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [matchId]);

  // Ignore a previous match's result while the new one loads.
  return result && result.matchId === matchId ? result.data : EMPTY;
}
