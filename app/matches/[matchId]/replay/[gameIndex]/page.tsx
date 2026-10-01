import Link from "next/link";
import { prismaReadOnly as prisma } from "@/lib/prisma";
import { decisionFromRowForReplay, buildRollLookup } from "@/lib/decisionFromRow";
import type { Decision } from "@/lib/mistakes";
import { resolveMyIdentity } from "@/lib/playerIdentity";
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

  // Decision.color is unreliable read directly off a row — confirmed
  // against real data, not assumed: most CUBE decisions (including at
  // least one genuine countAsDecision:true one seen in practice) store it
  // as an empty string, while Decision.userId is always populated.
  // Building a userId -> color map from every row that DOES have a
  // populated color (checked across 40 real games: every userId in every
  // game has at least one such row, and a given userId's color never
  // alternates within a game) is the only reliable way to know "whose
  // decision is this" — needed for the fixed-perspective toggle below, and
  // applied to fix up each displayed decision's own `color` field too,
  // rather than trusting the raw (possibly blank) value.
  const colorByUserId = new Map<string, string>();
  for (const row of rows) {
    if (row.color && !colorByUserId.has(row.userId)) {
      colorByUserId.set(row.userId, row.color);
    }
  }

  // Same "who is me" rule MistakesSection uses (lib/playerIdentity.ts):
  // every isMe identity is a candidate, not just the first, so both call
  // sites resolve identically.
  const myIdentities = await prisma.playerIdentity.findMany({ where: { isMe: true } });
  const myUserId =
    resolveMyIdentity(myIdentities, rows.map((row) => row.userId))?.sourceUserId ?? null;
  const myColor = myUserId ? colorByUserId.get(myUserId) ?? null : null;

  // countAsDecision: false rows are Galaxy's background per-roll "not close
  // enough to double" cube checks, not real moments in the game — filtered
  // out of the *stepped sequence* here, same scoping MistakeStat/
  // RepeatedPosition already use (prisma/schema.prisma's own recompute
  // queries), not on rawError/errorSeverity. A cube decision Galaxy did
  // grade (countAsDecision: true — doubled, passed, took, or a real
  // declined-double) comes through even when ungraded (rawError: null) —
  // decisionFromRowForReplay tolerates that (see its comment), so real
  // decisions are never silently dropped from the replay.
  const decisions = rows
    .filter((row) => row.countAsDecision)
    .map((row) => decisionFromRowForReplay(row, rollLookup))
    .filter((d): d is Decision => d !== null)
    // Overwrite with the resolved color (see colorByUserId above) rather
    // than decisionFromRowForReplay's own row.color passthrough, so every
    // decision's color is reliable regardless of whether that specific row
    // happened to have it populated.
    .map((d) => ({ ...d, color: colorByUserId.get(d.userId) ?? d.color }));

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
            myColor={myColor}
          />
        )}
      </main>
    </div>
  );
}
