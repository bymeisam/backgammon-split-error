"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { GameReviewsResponse } from "@/lib/gameReviewsTypes";
import MistakesSection from "@/app/matches/[matchId]/MistakesSection";

const MAX_GAMES = 20;

type Game = {
  gameIndex: number;
  data: GameReviewsResponse;
};

export default function DbMatchAnalysisPage() {
  const { matchId } = useParams<{ matchId: string }>();

  const [loading, setLoading] = useState(false);
  const [notIngested, setNotIngested] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [games, setGames] = useState<Game[]>([]);

  useEffect(() => {
    if (!matchId) return;

    let cancelled = false;

    async function run() {
      setError(null);
      setNotIngested(false);
      setGames([]);
      setLoading(true);

      const collected: Game[] = [];

      for (let gameIndex = 1; gameIndex <= MAX_GAMES; gameIndex++) {
        let res: Response;
        try {
          res = await fetch(`/api/local/matches/${matchId}/${gameIndex}`);
        } catch {
          if (!cancelled) setError("Network error reading from the database.");
          break;
        }

        if (res.status === 404) {
          if (gameIndex === 1 && !cancelled) setNotIngested(true);
          break;
        }

        if (!res.ok) {
          if (!cancelled) setError(`Request failed (${res.status}).`);
          break;
        }

        const data = (await res.json()) as GameReviewsResponse;
        collected.push({ gameIndex, data });
        if (!cancelled) setGames([...collected]);
      }

      if (!cancelled) setLoading(false);
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [matchId]);

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 dark:bg-black">
      <main className="flex w-full max-w-7xl flex-col gap-6 px-6 py-12">
        <div className="flex w-full max-w-2xl flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
            Match {matchId} (DB)
          </h1>
          {loading && (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Loading…</p>
          )}
          {error && (
            <p className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
              {error}
            </p>
          )}
          {notIngested && (
            <p className="rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-zinc-600 dark:border-white/15 dark:bg-zinc-900 dark:text-zinc-400">
              This match hasn&apos;t been fully ingested yet.
            </p>
          )}
        </div>

        {!notIngested && <MistakesSection games={games} />}
      </main>
    </div>
  );
}
