"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useGameStatsAuth } from "@/app/GameStatsProvider";
import type { GameReviewsResponse } from "@/lib/gameReviewsTypes";
import MistakesSection from "@/app/components/match-analysis/MistakesSection";
import { style } from "./galaxyMatchDetail.styles";

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
    <div className={style.pageContainer}>
      <main className={style.main}>
        <div className={style.headerBlock}>
          <h1 className={style.title}>Match {matchId}</h1>
          <p className={style.statusText}>{loading || (!error && status) ? status : null}</p>
          {error && <p className={style.errorBox}>{error}</p>}
        </div>

        <MistakesSection games={games} />
      </main>
    </div>
  );
}
