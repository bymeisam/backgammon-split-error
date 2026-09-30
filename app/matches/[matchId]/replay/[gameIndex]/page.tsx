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

  // Every Decision row for this game, in play order — fetched unfiltered
  // (no countAsDecision or rawError condition on the query itself) because
  // buildRollLookup needs the countAsDecision:false cube-check rows too:
  // each one carries the dice_rolled event a checker decision's own roll is
  // looked up from (see lib/decisionFromRow.ts's own comment on
  // buildRollLookup) — dropping them from the query would silently blank
  // out every checker decision's dice display, not just hide the cube
  // checks themselves.
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
      countAsDecision: true,
      rawError: true,
      errorSeverity: true,
      raw: true,
      game: { select: { gameIndex: true } },
    },
  });

  const rollLookup = buildRollLookup(rows);

  // countAsDecision: false rows are Galaxy's background per-roll "not close
  // enough to double" cube checks, not real moments in the game — filtered
  // out of the *stepped sequence* here, same scoping MistakeStat/
  // RepeatedPosition already use (prisma/schema.prisma's own recompute
  // queries), not on rawError/errorSeverity. A cube decision Galaxy did
  // grade (countAsDecision: true — doubled, passed, took, or a real
  // declined-double) still comes through below exactly as before,
  // regardless of whether it happens to be ungraded (rawError: null) —
  // decisionFromRowForReplay's own null-tolerance (see its comment) is
  // unchanged, so this doesn't reintroduce the "silently drops ungraded-
  // but-real decisions" bug the replay was already built to avoid.
  const decisions = rows
    .filter((row) => row.countAsDecision)
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
