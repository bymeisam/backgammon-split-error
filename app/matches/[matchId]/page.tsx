"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { GameReviewsResponse } from "@/lib/gameReviewsTypes";
import MistakesSection from "@/app/components/match-analysis/MistakesSection";
import { style } from "./matchDetail.styles";

const MAX_GAMES = 20;

type Game = {
  gameIndex: number;
  data: GameReviewsResponse;
};

export default function MatchAnalysisPage() {
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
          res = await fetch(`/api/matches/${matchId}/${gameIndex}`);
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
    <div className={style.pageContainer}>
      <main className={style.main}>
        <div className={style.headerBlock}>
          <h1 className={style.title}>Match {matchId}</h1>
          {loading && <p className={style.loadingText}>Loading…</p>}
          {error && <p className={style.errorBox}>{error}</p>}
          {notIngested && (
            <p className={style.notIngestedBox}>This match hasn&apos;t been fully ingested yet.</p>
          )}
        </div>

        {games.length > 0 && (
          <div className={style.replayRow}>
            <span className={style.replayLabel}>Replay:</span>
            {games.map((g) => (
              <Link
                key={g.gameIndex}
                href={`/matches/${matchId}/replay/${g.gameIndex}`}
                className={style.replayLink}
              >
                Game {g.gameIndex}
              </Link>
            ))}
          </div>
        )}

        {!notIngested && <MistakesSection games={games} />}
      </main>
    </div>
  );
}
