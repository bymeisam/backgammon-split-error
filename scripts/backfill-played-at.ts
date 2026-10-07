// Reconciliation: recomputes Match.playedAt for every already-ingested match,
// entirely from data already in the DB — no live Galaxy calls. Useful if
// lib/ingest.ts's playedAt rule ever changes again (see docs/field-mapping.md's
// playedAt section for the full story: the historical 2026-09 backfill's
// dates reflect when this app requested each match's analysis, not when it
// was played, and nothing can recover the real ones).
//
// Rule (matches lib/ingest.ts exactly, so re-running a live ingest and
// running this script against the same underlying events produce the same
// result):
//   Match.playedAt = metadata.timestamp of the first decision (by eventId,
//                    not by timestamp value) with a populated
//                    error_analysis, in the match's first game (lowest
//                    gameIndex) that has one.
// Since 2026-10-07 only Match.playedAt is stored; the per-game
// Game.playedAt this script used to reconcile too was dropped (nothing read
// it).
//
// Reads Decision.raw JSON directly (the same source ingest.ts itself parses),
// so this is an independent re-derivation, not a replay of stored values.
//
// Usage:
//   npx tsx scripts/backfill-played-at.ts --dry-run   # compute + log only
//   npx tsx scripts/backfill-played-at.ts             # actually write
//
// Runs against whatever DATABASE_URL is currently configured in .env — no
// environment-specific logic here; local vs Oracle is purely a .env concern
// (lib/prisma.ts already handles both transparently).
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import type { GameEvent } from "@/lib/gameReviewsTypes";

const DRY_RUN = process.argv.includes("--dry-run");
const PROGRESS_INTERVAL = 500;

function errorAnalysisIsPopulated(event: GameEvent): boolean {
  const review = event.reviews?.[0];
  return review !== undefined && review.result.result.error_analysis !== null;
}

function timestampOf(event: GameEvent): Date {
  return new Date(event.reviews[0].result.result.metadata.timestamp);
}

// The raw timestamp of this game's first decision by eventId with a
// populated error_analysis, or null if none exists. The common case (true
// for every Decision row today, since lib/ingest.ts never stores one
// otherwise) is answered by fetching just the single lowest-eventId row;
// only falls back to loading the rest of the game's decisions if that one
// somehow doesn't qualify.
async function firstValidDecisionTimestamp(gameId: number): Promise<Date | null> {
  const first = await prisma.decision.findFirst({
    where: { gameId },
    orderBy: { eventId: "asc" },
    select: { raw: true },
  });
  if (!first) return null;

  const firstEvent = first.raw as unknown as GameEvent;
  if (errorAnalysisIsPopulated(firstEvent)) {
    return timestampOf(firstEvent);
  }

  // Defensive fallback — not expected to ever trigger, but the rule is
  // "first decision *with a populated error_analysis*", not just "first
  // decision", so don't silently assume row order already satisfies that.
  const rest = await prisma.decision.findMany({
    where: { gameId },
    orderBy: { eventId: "asc" },
    select: { raw: true },
  });
  for (const d of rest) {
    const event = d.raw as unknown as GameEvent;
    if (errorAnalysisIsPopulated(event)) return timestampOf(event);
  }
  return null;
}

function sameInstant(a: Date | null, b: Date | null): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  return a.getTime() === b.getTime();
}

async function main() {
  console.log(DRY_RUN ? "DRY RUN — computing only, nothing will be written.\n" : "LIVE RUN — will write changes.\n");

  const matches = await prisma.match.findMany({
    select: { id: true, sourceMatchId: true, playedAt: true },
    orderBy: { id: "asc" },
  });
  console.log(`Matches to process: ${matches.length}\n`);

  let matchesProcessed = 0;
  let matchesChanged = 0;
  let matchesUnchanged = 0;
  let matchesNoValidDecision = 0;

  for (const match of matches) {
    matchesProcessed++;

    const games = await prisma.game.findMany({
      where: { matchId: match.id },
      select: { id: true },
      orderBy: { gameIndex: "asc" },
    });

    // First game (in gameIndex order) that produces a value drives
    // Match.playedAt, exactly as lib/ingest.ts does.
    let matchPlayedAt: Date | null = null;
    for (const game of games) {
      matchPlayedAt = await firstValidDecisionTimestamp(game.id);
      if (matchPlayedAt !== null) break;
    }

    if (matchPlayedAt === null) {
      matchesNoValidDecision++;
      console.warn(
        `[edge case] match ${match.sourceMatchId}: no game had a decision with a populated error_analysis — Match.playedAt left as ${match.playedAt?.toISOString() ?? "null"}`
      );
      continue;
    }

    if (sameInstant(match.playedAt, matchPlayedAt)) {
      matchesUnchanged++;
    } else {
      matchesChanged++;
      console.log(
        `${DRY_RUN ? "[would change]" : "[changed]"} match ${match.sourceMatchId}: ${match.playedAt?.toISOString() ?? "null"} -> ${matchPlayedAt.toISOString()}`
      );
      if (!DRY_RUN) {
        await prisma.match.update({ where: { id: match.id }, data: { playedAt: matchPlayedAt } });
      }
    }

    if (matchesProcessed % PROGRESS_INTERVAL === 0) {
      console.log(`... ${matchesProcessed}/${matches.length} matches processed`);
    }
  }

  console.log("\n=== Summary ===");
  console.log(DRY_RUN ? "(dry run — nothing was written)" : "(live run — changes above were written)");
  console.log(
    `Matches: ${matchesProcessed} processed, ${matchesChanged} changed, ${matchesUnchanged} unchanged, ${matchesNoValidDecision} with no valid decision found`
  );

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
