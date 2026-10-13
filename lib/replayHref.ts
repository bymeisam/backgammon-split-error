// The replay URL opened on one decision: the replay page selects the decision
// whose id matches ?decision= (app/matches/[matchId]/replay/[gameIndex]).
// Used by review cards, /review/cards and forum attachments.
export function replayHref(sourceMatchId: string, gameIndex: number, decisionId: number | string): string {
  return `/matches/${encodeURIComponent(sourceMatchId)}/replay/${gameIndex}?decision=${decisionId}`;
}
