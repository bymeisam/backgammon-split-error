// One-time reconciliation: resolves Game.userScore/opponentScore/
// crawfordState and Match.matchLength for every already-ingested match,
// using the rule lib/ingest.ts now uses (see docs/field-mapping.md) —
// replacing the old Decision.matchScoreBlack/matchScoreWhite/crawfordState
// columns (dropped 2026-10-02, confirmed write-only and confirmed
// unreliable at per-decision granularity — see reports/2026-10-02-raw-
// field-reverification.md) and fixing Match.matchLength's old "whichever
// event is processed last" bug.
//
// Rule (matches lib/ingest.ts's gameScoreByEventId exactly):
//   For each game, find the first event (by eventId, not literally the
//   first event) whose metadata.scores is non-null. From that SAME event,
//   resolve userScore/opponentScore (actor-relative: metadata.scores.black/
//   .white mean "whoever made this decision"/"their opponent", not a
//   literal board color — resolved against PlayerIdentity.isMe) and
//   crawfordState (metadata.crawford_state). Match.matchLength = the
//   resolved metadata.match_length of the match's first game that resolves
//   one. A game/match where no event ever has real scores (a genuine money
//   game, a confirmed real category) correctly resolves nothing and is left
//   null.
//
// Reads Decision.raw JSON directly (the same source lib/ingest.ts itself
// parses), not any already-materialized column — this script is
// independent of migration ordering (the old Decision score/crawford
// columns may already be dropped by the time this runs).
//
// Usage:
//   npx tsx scripts/backfill-game-score-crawford.ts --dry-run   # compute + log only
//   npx tsx scripts/backfill-game-score-crawford.ts             # actually write
//
// Runs against whatever DATABASE_URL is currently configured in .env — no
// environment-specific logic here; local vs Oracle is purely a .env concern.
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import type { GameEvent } from "@/lib/gameReviewsTypes";

const DRY_RUN = process.argv.includes("--dry-run");
const PROGRESS_INTERVAL = 500;
const SOURCE = "galaxy";

interface Resolved {
  userScore: number;
  opponentScore: number;
  crawfordState: string;
  matchLength: number;
}

// Mirrors lib/ingest.ts's `if (me && metadata.scores)` gating exactly: all
// four values resolve together from one event, or none do — never a
// partial result (e.g. a resolved crawfordState with no matching userScore,
// which real ingest never produces either).
function resolveFromEvent(event: GameEvent, meSourceUserId: string | null): Resolved | null {
  if (meSourceUserId === null) return null;
  const metadata = event.reviews?.[0]?.result.result.metadata;
  if (!metadata?.scores) return null;

  const isMe = event.user_id === meSourceUserId;
  return {
    userScore: isMe ? metadata.scores.black : metadata.scores.white,
    opponentScore: isMe ? metadata.scores.white : metadata.scores.black,
    crawfordState: metadata.crawford_state,
    matchLength: metadata.match_length,
  };
}

// Fetches this game's decisions ordered by eventId and returns the first
// one that resolves — or null if none do (a genuine money game, or a game
// with no decisions at all).
async function firstResolvedForGame(gameId: number, meSourceUserId: string | null): Promise<Resolved | null> {
  const decisions = await prisma.decision.findMany({
    where: { gameId },
    orderBy: { eventId: "asc" },
    select: { raw: true },
  });
  for (const d of decisions) {
    const resolved = resolveFromEvent(d.raw as unknown as GameEvent, meSourceUserId);
    if (resolved) return resolved;
  }
  return null;
}

async function main() {
  console.log(DRY_RUN ? "DRY RUN — computing only, nothing will be written.\n" : "LIVE RUN — will write changes.\n");

  const me = await prisma.playerIdentity.findFirst({ where: { source: SOURCE, isMe: true } });
  if (!me) {
    console.warn(
      "No PlayerIdentity with isMe: true found — userScore/opponentScore/crawfordState/matchLength cannot be actor-relativized and will be left as-is for every match. Run this again once identity is resolved.\n"
    );
  } else {
    console.log(`Resolved "me" as PlayerIdentity sourceUserId ${me.sourceUserId}.\n`);
  }

  const matches = await prisma.match.findMany({
    select: { id: true, sourceMatchId: true, matchLength: true },
    orderBy: { id: "asc" },
  });
  console.log(`Matches to process: ${matches.length}\n`);

  let matchesProcessed = 0;
  let matchesChanged = 0;
  let matchesUnchanged = 0;
  let matchesNoValidDecision = 0;

  let gamesProcessed = 0;
  let gamesChanged = 0;
  let gamesUnchanged = 0;
  let gamesNoValidDecision = 0;

  for (const match of matches) {
    matchesProcessed++;

    const games = await prisma.game.findMany({
      where: { matchId: match.id },
      select: { id: true, gameIndex: true, userScore: true, opponentScore: true, crawfordState: true },
      orderBy: { gameIndex: "asc" },
    });

    let matchLength: number | null = null;

    for (const game of games) {
      gamesProcessed++;

      const resolved = await firstResolvedForGame(game.id, me?.sourceUserId ?? null);
      if (resolved === null) {
        gamesNoValidDecision++;
        continue;
      }

      // First game (in gameIndex order) that resolves one drives
      // Match.matchLength, exactly as lib/ingest.ts does.
      if (matchLength === null) matchLength = resolved.matchLength;

      const unchanged =
        game.userScore === resolved.userScore &&
        game.opponentScore === resolved.opponentScore &&
        game.crawfordState === resolved.crawfordState;

      if (unchanged) {
        gamesUnchanged++;
      } else {
        gamesChanged++;
        console.log(
          `${DRY_RUN ? "[would change]" : "[changed]"} match ${match.sourceMatchId} game ${game.gameIndex}: ` +
            `userScore ${game.userScore ?? "null"}->${resolved.userScore}, ` +
            `opponentScore ${game.opponentScore ?? "null"}->${resolved.opponentScore}, ` +
            `crawfordState ${game.crawfordState ?? "null"}->${resolved.crawfordState}`
        );
        if (!DRY_RUN) {
          await prisma.game.update({
            where: { id: game.id },
            data: {
              userScore: resolved.userScore,
              opponentScore: resolved.opponentScore,
              crawfordState: resolved.crawfordState,
            },
          });
        }
      }
    }

    if (matchLength === null) {
      matchesNoValidDecision++;
      continue;
    }

    if (match.matchLength === matchLength) {
      matchesUnchanged++;
    } else {
      matchesChanged++;
      console.log(
        `${DRY_RUN ? "[would change]" : "[changed]"} match ${match.sourceMatchId}: matchLength ${match.matchLength ?? "null"} -> ${matchLength}`
      );
      if (!DRY_RUN) {
        await prisma.match.update({ where: { id: match.id }, data: { matchLength } });
      }
    }

    if (matchesProcessed % PROGRESS_INTERVAL === 0) {
      console.log(`... ${matchesProcessed}/${matches.length} matches processed`);
    }
  }

  console.log("\n=== Summary ===");
  console.log(DRY_RUN ? "(dry run — nothing was written)" : "(live run — changes above were written)");
  console.log(
    `Matches: ${matchesProcessed} processed, ${matchesChanged} changed, ${matchesUnchanged} unchanged, ${matchesNoValidDecision} with no resolvable game (genuine money match or no decisions)`
  );
  console.log(
    `Games:   ${gamesProcessed} processed, ${gamesChanged} changed, ${gamesUnchanged} unchanged, ${gamesNoValidDecision} with nothing to resolve`
  );

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
