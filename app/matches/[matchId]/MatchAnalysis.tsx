"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { localGamesError } from "@/lib/sequentialGames";
import { GALAXY_SOURCE, externalMatchUrl } from "@/lib/externalMatchUrl";
import { extractPlayerOptions } from "@/lib/mistakes";
import { formatMatchDate } from "@/lib/formatDate";
import { resolveMyIdentity, resolveOpponentIdentity } from "@/lib/playerIdentity";
import { useSequentialGames } from "@/app/hooks/useSequentialGames";
import { usePlayerIdentities } from "@/app/hooks/usePlayerIdentities";
import MistakesSection from "@/app/components/match-analysis/MistakesSection";
import PageShell, { VsTitle } from "@/app/components/ui/PageShell";
import GameSwitcher from "@/app/components/ui/GameSwitcher";
import { style } from "./matchDetail.styles";

// The match row's date and final score, for the sub line (page.tsx looks
// them up). Null when the match isn't stored or the lookup failed.
export interface MatchSummary {
  // ISO string; formatted here, in the browser's time zone.
  playedAt: string | null;
  userScore: number;
  opponentScore: number;
}

// The match page's client part: it loads the games one by one from
// /api/matches/[matchId]/[gameIndex] (lib/local-client.ts).
export default function MatchAnalysis({ summary }: { summary: MatchSummary | null }) {
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
  const playerIds = useMemo(() => extractPlayerOptions(games).map((p) => p.userId), [games]);
  const opponent = useMemo(() => resolveOpponentIdentity(identities, playerIds), [identities, playerIds]);
  // "You: meisam2" in the sub line — the same rule MistakesSection uses to
  // pick whose mistakes it lists (lib/playerIdentity.ts).
  const me = useMemo(() => resolveMyIdentity(identities, playerIds), [identities, playerIds]);
  const crumbLabel = opponent ? `${opponent.displayName} (${matchId})` : `Match ${matchId}`;

  return (
    <PageShell
      variant="detail"
      breadcrumbs={[{ label: "Matches", href: "/matches" }, { label: crumbLabel }]}
      title={opponent ? <VsTitle name={opponent.displayName} /> : `Match ${matchId}`}
      subtitle={
        <>
          Match {matchId}
          {summary?.playedAt && (
            // Formatted in the browser's zone; the server's render may
            // differ near midnight, so hydration replaces it quietly.
            <span suppressHydrationWarning> · {formatMatchDate(summary.playedAt)}</span>
          )}
          {summary && ` · ${summary.userScore}–${summary.opponentScore}`}
          {me && ` · You: ${me.displayName}`}
        </>
      }
      actions={
        games.length > 0 ? (
          <>
            <GameSwitcher matchId={matchId} games={games.map((g) => g.gameIndex)} label="Replay" />
            {externalHref && (
              <a href={externalHref} target="_blank" rel="noopener noreferrer" className={style.externalLink}>
                View on Galaxy ↗
              </a>
            )}
          </>
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

      {!notIngested && <MistakesSection matchId={matchId} games={games} bleed />}
    </PageShell>
  );
}
