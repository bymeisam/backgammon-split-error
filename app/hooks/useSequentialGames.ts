import { useEffect, useState } from "react";
import type { FetchedGame } from "@/lib/mistakes";
import type { GameReviewsResponse } from "@/lib/gameReviewsTypes";
import { MAX_GAMES, classifyGameResponse, type GameStop } from "@/lib/sequentialGames";

interface SequentialGamesState {
  games: FetchedGame[];
  loading: boolean;
  fetchingIndex: number | null;
  stop: GameStop | null;
}

const IDLE: SequentialGamesState = { games: [], loading: false, fetchingIndex: null, stop: null };

async function errorMessageOf(res: Response): Promise<string | null> {
  try {
    const json = await res.json();
    return typeof json?.error === "string" && json.error ? json.error : null;
  } catch {
    return null;
  }
}

// Loads a match's games one request at a time (see lib/sequentialGames.ts),
// publishing each as it arrives. `fetchGame` must be memoized by the caller
// — a new function restarts the load — and null means "don't load yet"
// (e.g. no token). The previous run is abandoned, not raced, when it changes.
export function useSequentialGames(fetchGame: ((gameIndex: number) => Promise<Response>) | null) {
  const [state, setState] = useState<SequentialGamesState>(IDLE);

  useEffect(() => {
    if (!fetchGame) return;
    let cancelled = false;

    async function run(fetchGame: (gameIndex: number) => Promise<Response>) {
      setState({ games: [], loading: true, fetchingIndex: 1, stop: null });
      const collected: FetchedGame[] = [];
      let stop: GameStop = { kind: "end" };

      for (let gameIndex = 1; gameIndex <= MAX_GAMES; gameIndex++) {
        if (!cancelled) setState((s) => ({ ...s, fetchingIndex: gameIndex }));

        let res: Response;
        try {
          res = await fetchGame(gameIndex);
        } catch {
          stop = { kind: "network", gameIndex };
          break;
        }

        const kind = classifyGameResponse(res.status, gameIndex);
        if (kind === "end" || kind === "missing") {
          stop = { kind };
          break;
        }
        if (kind === "failed") {
          stop = { kind, gameIndex, status: res.status, serverMessage: await errorMessageOf(res) };
          break;
        }

        collected.push({ gameIndex, data: (await res.json()) as GameReviewsResponse });
        if (!cancelled) setState((s) => ({ ...s, games: [...collected] }));
      }

      if (!cancelled) setState((s) => ({ ...s, loading: false, fetchingIndex: null, stop }));
    }

    run(fetchGame);
    return () => {
      cancelled = true;
    };
  }, [fetchGame]);

  return state;
}
