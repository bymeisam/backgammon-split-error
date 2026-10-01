"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { localGamesError } from "@/lib/sequentialGames";
import { useSequentialGames } from "@/app/hooks/useSequentialGames";
import MistakesSection from "@/app/components/match-analysis/MistakesSection";
import { style } from "./matchDetail.styles";

export default function MatchAnalysisPage() {
  const { matchId } = useParams<{ matchId: string }>();

  const fetchGame = useMemo(
    () => (matchId ? (gameIndex: number) => fetch(`/api/matches/${matchId}/${gameIndex}`) : null),
    [matchId]
  );
  const { games, loading, stop } = useSequentialGames(fetchGame);
  const error = localGamesError(stop);
  const notIngested = stop?.kind === "missing";

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
