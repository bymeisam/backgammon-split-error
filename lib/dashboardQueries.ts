// Read-only queries for the app shell: the navbar's "last synced" line and
// the home dashboard's weekly mistakes. prismaReadOnly only; nothing here
// writes. (The latest matches and the current rating reuse
// lib/local-client.ts's listMatches; the due count is lib/review/dueCount.ts.)
import { ErrorSeverity, Prisma } from "@/lib/generated/prisma/client";
import { prismaReadOnly as prisma } from "@/lib/prisma";
import { LISTED_KINDS } from "@/lib/listParams";
import { WEEK_MS, tallyWeeklyMistakes, type WeeklyMistakeRow, type WeeklyMistakes } from "@/lib/dashboardStats";

// The latest sync run that finished (lib/sync.ts sets finishedAt at the
// end of every run). SyncRun is small (one row per run), so no index is
// needed. Write mode only: the navbar never calls this on the read-only site.
export async function latestFinishedSyncRun(): Promise<{ finishedAt: Date; matchesSynced: number } | null> {
  const run = await prisma.syncRun.findFirst({
    where: { finishedAt: { not: null } },
    orderBy: { finishedAt: "desc" },
    select: { finishedAt: true, matchesSynced: true },
  });
  return run?.finishedAt ? { finishedAt: run.finishedAt, matchesSynced: run.matchesSynced } : null;
}

// The user's own errors and blunders in matches played in the last 7 days
// (Match.playedAt — Galaxy's serve time, close to the real play date for a
// match synced soon after it was played; see docs/field-mapping.md), split
// checker/cube. Same decision scope as the mistake lists: counted
// decisions (countAsDecision, rawError not null), checker and cube only
// (LISTED_KINDS — resignations never). "The user's own" = Decision.userId
// is an isMe PlayerIdentity of the match's source, the rule
// lib/playerIdentity.ts's resolveMyIdentity uses. One grouped query.
export async function weeklyMistakes(now: Date): Promise<WeeklyMistakes> {
  const since = new Date(now.getTime() - WEEK_MS);
  const rows = await prisma.$queryRaw<WeeklyMistakeRow[]>(Prisma.sql`
    SELECT d.kind AS kind, d.errorSeverity AS errorSeverity, COUNT(*) AS n
    FROM \`Match\` m
    JOIN \`Game\` g ON g.matchId = m.id
    JOIN \`Decision\` d ON d.gameId = g.id
    JOIN \`PlayerIdentity\` p
      ON p.source = m.source AND p.sourceUserId = d.userId AND p.isMe = TRUE
    WHERE m.playedAt >= ${since}
      AND d.countAsDecision = TRUE
      AND d.rawError IS NOT NULL
      AND d.kind IN (${Prisma.join([...LISTED_KINDS])})
      AND d.errorSeverity IN (${Prisma.join([ErrorSeverity.ERROR, ErrorSeverity.BLUNDER])})
    GROUP BY d.kind, d.errorSeverity
  `);
  return tallyWeeklyMistakes(rows);
}
