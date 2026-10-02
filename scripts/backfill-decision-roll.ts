// One-time backfill: computes Decision.roll for every already-ingested
// row, entirely from data already in the local DB — no live Galaxy calls.
// Needed because lib/ingest.ts's roll computation (see Decision.roll's own
// schema comment, and reports/2026-10-02-step4-dice-roll-column-design.md)
// didn't exist before this change — every row ingested before it has
// roll: null.
//
// Rule (matches lib/ingest.ts's rollByEventId exactly, which itself matches
// lib/mistakes.ts's findPrecedingRoll — the same backward scan the old
// read-time buildRollLookup used to re-run on every page load): for each
// gameId, order its decisions by eventId ascending and, for each one, walk
// backward for the nearest preceding dice_rolled/game_started event's own
// rolled_dice. Applied unconditionally for every kind, no fallback to a
// row's own rolled_dice (confirmed dead code in the old read-time version —
// see the design report) — faithfully replicating what's actually computed
// today, not a "corrected" value.
//
// Unlike scripts/backfill-ply-number.ts's shape (full-table extraction of
// a few scalar columns, no `raw` needed at all) — roll's extraction needs
// each game's full `raw` JSON to walk, which doesn't fit in memory for the
// whole table at once (same category of problem scripts/backfill-source-
// position-id.ts's first, wrong-shaped attempt hit, for a different
// reason: that one needed no cross-row context at all and was fixed with a
// single SQL UPDATE; this one genuinely needs cross-row context, which SQL
// can't express as cleanly as this project's own established JS walk, so
// it's processed in game-sized batches instead — bounded memory regardless
// of total table size). Cardinality is low either way (36 distinct non-
// empty rolls, confirmed in the design report) — unlike plyNumber, "already
// correct" can legitimately be null (not just "not yet backfilled"), so
// idempotency is a value comparison against each row's current roll
// (mirroring backfill-ply-number.ts's own old!==new check), not a `WHERE
// roll IS NULL` pre-filter.
//
// Usage:
//   npx tsx scripts/backfill-decision-roll.ts --dry-run   # compute + log only
//   npx tsx scripts/backfill-decision-roll.ts             # actually write
//
// Runs against whatever DATABASE_URL is currently configured in .env.
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/lib/generated/prisma/client";
import type { GameEvent } from "@/lib/gameReviewsTypes";
import { findPrecedingRoll } from "@/lib/mistakes";

const DRY_RUN = process.argv.includes("--dry-run");
const GAME_BATCH_SIZE = 300;
const NULL_KEY = "null";

interface Row {
  id: number;
  gameId: number;
  eventId: bigint;
  raw: unknown;
  roll: unknown;
}

function key(roll: number[] | null): string {
  return roll === null ? NULL_KEY : JSON.stringify(roll);
}

function sameRoll(a: unknown, b: number[] | null): boolean {
  return key((a as number[] | null) ?? null) === key(b);
}

async function main() {
  console.log(DRY_RUN ? "DRY RUN — computing only, nothing will be written.\n" : "LIVE RUN — will write changes.\n");

  const games = await prisma.game.findMany({ select: { id: true }, orderBy: { id: "asc" } });
  console.log(`Games to process: ${games.length}`);

  // Bucketed by computed roll (stringified) -> row ids that need writing —
  // at most ~37 keys regardless of table size (see the design report's
  // cardinality measurement), so holding every id in memory across the
  // whole table is cheap even though there are 1.2M+ of them in total.
  const idsByKey = new Map<string, number[]>();
  const valueByKey = new Map<string, number[] | null>();
  let processed = 0;
  let changed = 0;
  let unchanged = 0;

  for (let i = 0; i < games.length; i += GAME_BATCH_SIZE) {
    const gameIds = games.slice(i, i + GAME_BATCH_SIZE).map((g) => g.id);
    const rows: Row[] = await prisma.decision.findMany({
      where: { gameId: { in: gameIds } },
      select: { id: true, gameId: true, eventId: true, raw: true, roll: true },
      orderBy: [{ gameId: "asc" }, { eventId: "asc" }],
    });

    const byGame = new Map<number, Row[]>();
    for (const row of rows) {
      const group = byGame.get(row.gameId);
      if (group) group.push(row);
      else byGame.set(row.gameId, [row]);
    }

    for (const gameRows of byGame.values()) {
      const events = gameRows.map((r) => r.raw as unknown as GameEvent);
      gameRows.forEach((row, index) => {
        processed++;
        const roll = findPrecedingRoll(events, index);
        const newRoll = roll.length > 0 ? roll : null;

        if (sameRoll(row.roll, newRoll)) {
          unchanged++;
          return;
        }
        changed++;
        const k = key(newRoll);
        valueByKey.set(k, newRoll);
        const ids = idsByKey.get(k) ?? [];
        ids.push(row.id);
        idsByKey.set(k, ids);
      });
    }

    console.log(`... ${Math.min(i + GAME_BATCH_SIZE, games.length)}/${games.length} games`);
  }

  console.log(`\nDistinct roll values to write: ${idsByKey.size}`);
  console.log(`Decisions: ${changed} would change, ${unchanged} already correct\n`);

  if (!DRY_RUN) {
    for (const [k, ids] of idsByKey) {
      const value = valueByKey.get(k)!;
      await prisma.decision.updateMany({
        where: { id: { in: ids } },
        data: { roll: value === null ? Prisma.DbNull : value },
      });
      console.log(`Set roll = ${value === null ? "null" : JSON.stringify(value)} on ${ids.length} decisions`);
    }
  }

  console.log("\n=== Summary ===");
  console.log(DRY_RUN ? "(dry run — nothing was written)" : "(live run — changes above were written)");
  console.log(`Games processed: ${games.length}`);
  console.log(`Decisions: ${processed} total, ${changed} changed, ${unchanged} unchanged`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
