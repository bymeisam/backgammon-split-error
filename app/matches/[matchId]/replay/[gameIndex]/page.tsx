import Link from "next/link";
import { prismaReadOnly as prisma } from "@/lib/prisma";
import { decisionFromRowForReplay, buildRollLookup } from "@/lib/decisionFromRow";
import type { Decision } from "@/lib/mistakes";
import GameReplay from "./GameReplay";
import { style } from "./gameReplay.styles";

export const dynamic = "force-dynamic";

// Local-client/mistakes/repeated-positions all use this same "galaxy"
// source tag to resolve Match by (source, sourceMatchId) — see
// lib/local-client.ts.
const SOURCE = "galaxy";

export default async function GameReplayPage({
  params,
  searchParams,
}: {
  params: Promise<{ matchId: string; gameIndex: string }>;
  searchParams: Promise<{ position?: string }>;
}) {
  const { matchId, gameIndex: gameIndexParam } = await params;
  const { position } = await searchParams;
  const gameIndex = Number(gameIndexParam);

  if (!Number.isInteger(gameIndex) || gameIndex < 1) {
    return (
      <div className={style.pageContainer}>
        <main className={style.main}>
          <p className={style.notFoundBox}>Invalid game number.</p>
        </main>
      </div>
    );
  }

  const match = await prisma.match.findUnique({
    where: { source_sourceMatchId: { source: SOURCE, sourceMatchId: matchId } },
  });

  if (!match) {
    return (
      <div className={style.pageContainer}>
        <main className={style.main}>
          <p className={style.notFoundBox}>
            Match {matchId} hasn&apos;t been ingested yet.
          </p>
        </main>
      </div>
    );
  }

  // Full sorted game-index list for this match, not just the requested one
  // — needed to resolve the previous/next game for the boundary-crossing
  // navigation below. Cheap: a handful of rows, id/gameIndex only.
  const allGames = await prisma.game.findMany({
    where: { matchId: match.id },
    select: { id: true, gameIndex: true },
    orderBy: { gameIndex: "asc" },
  });

  const gamePosition = allGames.findIndex((g) => g.gameIndex === gameIndex);
  const game = gamePosition === -1 ? null : allGames[gamePosition];

  if (!game) {
    return (
      <div className={style.pageContainer}>
        <main className={style.main}>
          <div className={style.headerBlock}>
            <h1 className={style.title}>Match {matchId}</h1>
            <Link href={`/matches/${matchId}`} className={style.backLink}>
              ← Back to match
            </Link>
          </div>
          <p className={style.notFoundBox}>
            Game {gameIndex} doesn&apos;t exist for this match
            {allGames.length > 0 && ` (it has ${allGames.length} game${allGames.length === 1 ? "" : "s"})`}.
          </p>
        </main>
      </div>
    );
  }

  const prevGameIndex = gamePosition > 0 ? allGames[gamePosition - 1].gameIndex : null;
  const nextGameIndex =
    gamePosition < allGames.length - 1 ? allGames[gamePosition + 1].gameIndex : null;

  // Every Decision row for this game, in play order — no countAsDecision or
  // rawError filter (unlike /mistakes' DecisionListSection), since a replay
  // reconstructs the game exactly as played, forced moves and
  // countAsDecision:false cube-checks included.
  const rows = await prisma.decision.findMany({
    where: { gameId: game.id },
    orderBy: { eventId: "asc" },
    select: {
      id: true,
      gameId: true,
      eventId: true,
      userId: true,
      color: true,
      kind: true,
      rawError: true,
      errorSeverity: true,
      raw: true,
      game: { select: { gameIndex: true } },
    },
  });

  const rollLookup = buildRollLookup(rows);
  const decisions = rows
    .map((row) => decisionFromRowForReplay(row, rollLookup))
    .filter((d): d is Decision => d !== null);

  const initialIndex = position === "last" ? Math.max(0, decisions.length - 1) : 0;

  return (
    <div className={style.pageContainer}>
      <main className={style.main}>
        <div className={style.headerBlock}>
          <h1 className={style.title}>
            Match {matchId} — Game {gameIndex} replay
          </h1>
          <Link href={`/matches/${matchId}`} className={style.backLink}>
            ← Back to match
          </Link>
        </div>

        {decisions.length === 0 ? (
          <p className={style.emptyState}>No decisions recorded for this game.</p>
        ) : (
          <GameReplay
            matchId={matchId}
            decisions={decisions}
            prevGameIndex={prevGameIndex}
            nextGameIndex={nextGameIndex}
            initialIndex={initialIndex}
          />
        )}
      </main>
    </div>
  );
}
