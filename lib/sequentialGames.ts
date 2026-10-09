// Pure core of app/hooks/useSequentialGames.ts: /matches/[matchId] and
// /sources/galaxy/matches/[matchId] load a match by requesting game 1, 2, 3, … until
// a 404 says there are no more — neither data source has a "list games"
// call. Each page words the outcome its own way (the messages below).

// Hard cap on games per match — far above any real match's game count.
export const MAX_GAMES = 20;

// Why the loop stopped.
export type GameStop =
  | { kind: "end" } // 404 after game 1, or MAX_GAMES reached: normal end of match
  | { kind: "missing" } // 404 on game 1: no such match (or not ingested)
  | { kind: "failed"; gameIndex: number; status: number; serverMessage: string | null }
  | { kind: "network"; gameIndex: number };

export function classifyGameResponse(
  status: number,
  gameIndex: number
): "game" | "end" | "missing" | "failed" {
  if (status === 404) return gameIndex === 1 ? "missing" : "end";
  return status >= 200 && status < 300 ? "game" : "failed";
}

// /matches/[matchId] (local DB). "missing" isn't an error there — the page
// shows its own "not fully ingested yet" notice instead.
export function localGamesError(stop: GameStop | null): string | null {
  if (stop?.kind === "failed") return `Request failed (${stop.status}).`;
  if (stop?.kind === "network") return "Network error reading from the database.";
  return null;
}

// /sources/galaxy/matches/[matchId] (live Galaxy). A failure after game 1 is
// treated as the end of the match rather than an error — whatever loaded
// still shows.
export function galaxyGamesError(stop: GameStop | null): string | null {
  switch (stop?.kind) {
    case "missing":
      return "Galaxy API returned 404 for game 1. Check your match ID and authorization.";
    case "failed":
      return stop.gameIndex === 1 ? stop.serverMessage ?? `Request failed (${stop.status}).` : null;
    case "network":
      return "Network error contacting Galaxy API.";
    default:
      return null;
  }
}

export function galaxyGamesStatus(loading: boolean, fetchingIndex: number | null, gameCount: number, stopped: boolean): string {
  if (loading) return `Fetching game ${fetchingIndex}…`;
  if (stopped) return `Done — ${gameCount} game${gameCount === 1 ? "" : "s"} found`;
  return "";
}
