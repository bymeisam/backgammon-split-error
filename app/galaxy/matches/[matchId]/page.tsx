"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useGameStatsAuth } from "@/app/GameStatsProvider";
import type { GameReviewsResponse } from "@/lib/gameReviewsTypes";
import MistakesSection from "@/app/components/match-analysis/MistakesSection";

const MAX_GAMES = 20;

type Game = {
  gameIndex: number;
  data: GameReviewsResponse;
};

export default function GalaxyMatchAnalysisPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const router = useRouter();
  const { token } = useGameStatsAuth();

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [games, setGames] = useState<Game[]>([]);

  useEffect(() => {
    if (!token) {
      router.replace("/galaxy/matches");
    }
  }, [token, router]);

  useEffect(() => {
    if (!token || !matchId) return;

    let cancelled = false;

    async function run() {
      setError(null);
      setGames([]);
      setLoading(true);

      const collected: Game[] = [];

      for (let gameIndex = 1; gameIndex <= MAX_GAMES; gameIndex++) {
        if (!cancelled) setStatus(`Fetching game ${gameIndex}…`);

        let res: Response;
        try {
          res = await fetch(`/api/galaxy/matches/${matchId}/${gameIndex}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ authorization: token }),
          });
        } catch {
          if (!cancelled) setError("Network error contacting Galaxy API.");
          break;
        }

        if (res.status === 404) {
          if (gameIndex === 1 && !cancelled) {
            setError("Galaxy API returned 404 for game 1. Check your match ID and authorization.");
          }
          break;
        }

        if (!res.ok) {
          if (gameIndex === 1) {
            let message = `Request failed (${res.status}).`;
            try {
              const errJson = await res.json();
              if (errJson?.error) message = errJson.error;
            } catch {
              // ignore, keep default message
            }
            if (!cancelled) setError(message);
          }
          break;
        }

        const data = (await res.json()) as GameReviewsResponse;
        collected.push({ gameIndex, data });
        if (!cancelled) setGames([...collected]);
      }

      if (!cancelled) {
        setStatus(`Done — ${collected.length} game${collected.length === 1 ? "" : "s"} found`);
        setLoading(false);
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [token, matchId]);

  if (!token) return null;

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 dark:bg-black">
      <main className="flex w-full max-w-7xl flex-col gap-6 px-6 py-12">
        <div className="flex w-full max-w-2xl flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
            Match {matchId}
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {loading || (!error && status) ? status : null}
          </p>
          {error && (
            <p className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
              {error}
            </p>
          )}
        </div>

        <MistakesSection games={games} />
      </main>
    </div>
  );
}
