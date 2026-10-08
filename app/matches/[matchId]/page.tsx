"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { localGamesError } from "@/lib/sequentialGames";
import { GALAXY_SOURCE, externalMatchUrl } from "@/lib/externalMatchUrl";
import { extractPlayerOptions } from "@/lib/mistakes";
import { resolveOpponentIdentity } from "@/lib/playerIdentity";
import { useSequentialGames } from "@/app/hooks/useSequentialGames";
import { usePlayerIdentities } from "@/app/hooks/usePlayerIdentities";
import MistakesSection from "@/app/components/match-analysis/MistakesSection";
import PageShell from "@/app/components/ui/PageShell";
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
  // This page reads matches only through /api/matches/[matchId]/[gameIndex]
  // (lib/local-client.ts), which resolves them under the Galaxy source —
  // so every match shown here is a Galaxy match. If another source is ever
  // routed here, pass that match's real source instead.
  const externalHref = matchId ? externalMatchUrl(GALAXY_SOURCE, matchId) : null;

  // The breadcrumb's opponent: the PlayerIdentity (non-isMe) among the
  // loaded games' players — the same identity list MistakesSection loads.
  // "Match <id>" until it resolves (or if it doesn't).
  const identities = usePlayerIdentities();
  const opponent = useMemo(
    () => resolveOpponentIdentity(identities, extractPlayerOptions(games).map((p) => p.userId)),
    [identities, games]
  );
  const crumbLabel = opponent ? `${opponent.displayName} (${matchId})` : `Match ${matchId}`;

  return (
    <PageShell
      breadcrumbs={[{ label: "Matches", href: "/matches" }, { label: crumbLabel }]}
      title={`Match ${matchId}`}
      actions={
        games.length > 0 && externalHref ? (
          <a href={externalHref} target="_blank" rel="noopener noreferrer" className={style.externalLink}>
            View on Galaxy ↗
          </a>
        ) : null
      }
    >
      {(loading || error || notIngested) && (
        <div className={style.statusBlock}>
          {loading && <p className={style.loadingText}>Loading…</p>}
          {error && <p className={style.errorBox}>{error}</p>}
          {notIngested && (
            <p className={style.notIngestedBox}>This match hasn&apos;t been fully ingested yet.</p>
          )}
        </div>
      )}

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

      {!notIngested && <MistakesSection matchId={matchId} games={games} />}
    </PageShell>
  );
}
