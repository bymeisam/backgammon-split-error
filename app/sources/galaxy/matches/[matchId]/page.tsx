"use client";

import { useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useGameStatsAuth } from "@/app/providers/GameStatsAuthProvider";
import { galaxyPost } from "@/lib/galaxyPost";
import { galaxyGamesError, galaxyGamesStatus } from "@/lib/sequentialGames";
import { useSequentialGames } from "@/app/hooks/useSequentialGames";
import MistakesSection from "@/app/components/match-analysis/MistakesSection";
import PageShell from "@/app/components/ui/PageShell";
import { style } from "./galaxyMatchDetail.styles";

export default function GalaxyMatchAnalysisPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const router = useRouter();
  const { token } = useGameStatsAuth();

  // The token lives in memory only, so a reload (or a direct link) lands
  // here without one — send the user back to connect.
  useEffect(() => {
    if (!token) {
      router.replace("/sources/galaxy/matches");
    }
  }, [token, router]);

  const fetchGame = useMemo(
    () =>
      token && matchId
        ? (gameIndex: number) => galaxyPost(`/api/galaxy/matches/${matchId}/${gameIndex}`, token)
        : null,
    [token, matchId]
  );
  const { games, loading, fetchingIndex, stop } = useSequentialGames(fetchGame);
  const error = galaxyGamesError(stop);
  const status = galaxyGamesStatus(loading, fetchingIndex, games.length, stop !== null);

  if (!token) return null;

  return (
    <PageShell
      breadcrumbs={[
        { label: "Sources", href: "/sources" },
        { label: "Galaxy", href: "/sources#galaxy" },
        { label: "Matches", href: "/sources/galaxy/matches" },
        { label: `Match ${matchId}` },
      ]}
      title={`Match ${matchId}`}
    >
      <div className={style.statusBlock}>
        <p className={style.statusText}>{loading || (!error && status) ? status : null}</p>
        {error && <p className={style.errorBox}>{error}</p>}
      </div>

      {/* No matchId: /sources/galaxy is live Galaxy data and read-only, so no
          notes (see CLAUDE.md). */}
      <MistakesSection games={games} />
    </PageShell>
  );
}
