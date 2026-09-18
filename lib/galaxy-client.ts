// Galaxy-API-backed implementation of MatchDataClient. Fetch behavior here
// is unchanged from the original /api/matches and /api/game_reviews routes
// (same URLs via lib/galaxyEndpoints.ts, same end-of-match signal — a 200
// with an empty `events` array, not a 404 — same "no models" honesty about
// upstream failures) — only reshaped to the shared interface and given a
// per-request token via a factory instead of reading it out of a request
// body inline.
import type { MatchDataClient } from "@/lib/types/data-client";
import type { AnalysesListResponse } from "@/lib/analysesTypes";
import type { GameReviewsResponse } from "@/lib/gameReviewsTypes";
import { analysesListUrl, gameReviewsUrl } from "@/lib/galaxyEndpoints";

export function createGalaxyClient(authorization: string): MatchDataClient {
  return {
    async listMatches(page: number): Promise<AnalysesListResponse> {
      let res: Response;
      try {
        res = await fetch(analysesListUrl(page), {
          headers: { authorization },
          cache: "no-store",
        });
      } catch {
        throw new Error("Network error contacting Galaxy API.");
      }

      if (!res.ok) {
        throw new Error(`Galaxy API returned ${res.status} for page ${page}.`);
      }

      const text = await res.text();
      if (!text) {
        throw new Error("Galaxy API returned an empty response.");
      }

      try {
        return JSON.parse(text) as AnalysesListResponse;
      } catch {
        throw new Error("Galaxy API returned a non-JSON response.");
      }
    },

    async getGameReviews(
      matchId: number,
      gameIndex: number
    ): Promise<GameReviewsResponse | null> {
      let res: Response;
      try {
        res = await fetch(gameReviewsUrl(String(matchId), gameIndex), {
          headers: { authorization },
          cache: "no-store",
        });
      } catch {
        throw new Error("Network error contacting Galaxy API.");
      }

      // 404 is the literal "not found" case the shared interface expects.
      if (res.status === 404) return null;

      if (!res.ok) {
        throw new Error(
          `Galaxy API returned ${res.status} for match ${matchId} game ${gameIndex}.`
        );
      }

      const text = await res.text();
      if (!text) return null;

      let data: GameReviewsResponse;
      try {
        data = JSON.parse(text) as GameReviewsResponse;
      } catch {
        throw new Error("Galaxy API returned a non-JSON response.");
      }

      // Galaxy's real end-of-match signal: a 200 with an empty events array,
      // not a 404 — established from live testing, preserved as-is here.
      const events = data.data?.events;
      if (Array.isArray(events) && events.length === 0) return null;

      return data;
    },
  };
}
