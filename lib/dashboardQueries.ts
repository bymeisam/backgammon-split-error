// Read-only queries for the app shell: the Galaxy card's status on /sources
// (lib/sources.ts: the last sync and the library) and the home dashboard's
// weekly mistakes.
// prismaReadOnly only; nothing here writes. (The latest matches and the
// current rating reuse lib/local-client.ts's listMatches; the due count is
// lib/review/dueCount.ts.)
import { ErrorSeverity } from "@/lib/generated/prisma/client";
import { prismaReadOnly as prisma } from "@/lib/prisma";
import { LISTED_KINDS } from "@/lib/listParams";
import { WEEK_MS, tallyWeeklyMistakes, type WeeklyMistakeRow, type WeeklyMistakes } from "@/lib/dashboardStats";

// The latest sync run that finished (lib/sync.ts sets finishedAt at the
// end of every run). finishedAt has no index (SyncRun has only its primary
// key), which is fine: the table is one row per sync run (about 16 locally),
// so the sort is over a handful of rows. Write mode only: /sources, its one
// caller, is 404 on the read-only site.
export async function latestFinishedSyncRun(): Promise<{ finishedAt: Date; matchesSynced: number } | null> {
  const run = await prisma.syncRun.findFirst({
    where: { finishedAt: { not: null } },
    orderBy: { finishedAt: "desc" },
    select: { finishedAt: true, matchesSynced: true },
  });
  return run?.finishedAt ? { finishedAt: run.finishedAt, matchesSynced: run.matchesSynced } : null;
}

// A source's library: how many of its matches are fully ingested
// (ingestStatus DONE, the matches every view shows) and the latest played
// date among them (Match.playedAt, Galaxy's serve time; see
// docs/field-mapping.md). One aggregate. Match has no index on
// ingestStatus, which is fine: it's about 4.4k rows, and /sources (write
// mode only) is its one caller.
export async function sourceLibrary(source: string): Promise<{ matches: number; latestPlayedAt: Date | null }> {
  const agg = await prisma.match.aggregate({
    where: { source, ingestStatus: "DONE" },
    _count: { _all: true },
    _max: { playedAt: true },
  });
  return { matches: agg._count._all, latestPlayedAt: agg._max.playedAt };
}

// The user's own errors and blunders in matches played in the last 7 days
// (Match.playedAt — Galaxy's serve time, close to the real play date for a
// match synced soon after it was played; see docs/field-mapping.md), split
// checker/cube. Same decision scope as the mistake lists: counted
// decisions (countAsDecision, rawError not null), checker and cube only
// (LISTED_KINDS — resignations never). "The user's own" = Decision.userId
// is an isMe PlayerIdentity of the match's source, the rule
// lib/playerIdentity.ts's resolveMyIdentity uses.
//
// Small steps, driven from the recent matches. A single four-table join
// let MySQL drive from PlayerIdentity through Decision's userId index
// instead — every one of the user's decisions (633,728 rows read on Oracle,
// 7.9 s) before filtering by playedAt. Here:
//   1. the isMe identities (a few rows);
//   2. the recent matches (Match is ~4.4k rows; a full scan is cheap);
//   3. their games (Game's (matchId, gameIndex) unique key);
//   4. one grouped Decision count over those game ids, which reaches
//      Decision through its (gameId, eventId) unique key.
// No new index (no DB change). Counts are identical to the join: same
// filters, and userIds are matched per source as the join's
// p.source = m.source did.
export async function weeklyMistakes(now: Date): Promise<WeeklyMistakes> {
  const since = new Date(now.getTime() - WEEK_MS);

  const [identities, matches] = await Promise.all([
    prisma.playerIdentity.findMany({ where: { isMe: true }, select: { source: true, sourceUserId: true } }),
    prisma.match.findMany({ where: { playedAt: { gte: since } }, select: { id: true, source: true } }),
  ]);

  const rows: WeeklyMistakeRow[] = [];
  for (const source of new Set(matches.map((m) => m.source))) {
    const userIds = identities.filter((i) => i.source === source).map((i) => i.sourceUserId);
    const matchIds = matches.filter((m) => m.source === source).map((m) => m.id);
    if (userIds.length === 0 || matchIds.length === 0) continue;

    const games = await prisma.game.findMany({ where: { matchId: { in: matchIds } }, select: { id: true } });
    if (games.length === 0) continue;

    const groups = await prisma.decision.groupBy({
      by: ["kind", "errorSeverity"],
      where: {
        gameId: { in: games.map((g) => g.id) },
        userId: { in: userIds },
        countAsDecision: true,
        rawError: { not: null },
        kind: { in: [...LISTED_KINDS] },
        errorSeverity: { in: [ErrorSeverity.ERROR, ErrorSeverity.BLUNDER] },
      },
      _count: { _all: true },
    });
    for (const g of groups) rows.push({ kind: g.kind, errorSeverity: g.errorSeverity, n: g._count._all });
  }
  return tallyWeeklyMistakes(rows);
}
