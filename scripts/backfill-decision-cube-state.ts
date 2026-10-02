// One-time backfill: computes Decision.cubeOwnerUserId (widened to every
// kind)/cubeValue/cubeConfident for every already-ingested row, entirely
// from data already in the local DB — no live Galaxy calls.
//
// Rule: cubeValue/cubeConfident come from lib/cubeState.ts's own
// computeCubeStates, called once per game (the exact function the old
// read-time buildCubeStateLookup — now removed — used to re-run on every
// page load). cubeOwnerUserId comes from a small standalone absolute-owner
// walk matching lib/ingest.ts's own exactly (same update condition:
// analysed_event === "cube_pass" && review.take === true) — not derived
// from computeCubeStates' own (relative) owner field, since reconstructing
// absolute from relative would need to know both players' ids per game.
// Verified directly that the two walks never disagree (0 mismatches across
// all 1,257,534 rows) before relying on this — see reports/2026-10-02-
// step5-cube-value-confident-design.md.
//
// IMPORTANT, scope-limited by explicit choice: this reads only already-
// stored Decision rows, same as the old read-time computeCubeStates always
// did — so it inherits the same ~21% false-confident:false rate the design
// report measured and explains (mostly double_accepted/double_rejected
// events stored with a null error_analysis, silently dropped at ingest,
// so a DB-row-only walk can never see the double's resolution). Ingest-
// time computation fixes this for new data going forward; this backfill
// does NOT re-fetch anything live to retroactively fix historical data —
// that was an explicit, deliberate scope decision, not an oversight.
//
// Per-game-chunked (same reasoning as scripts/backfill-decision-roll.ts —
// needs each game's full raw JSON to walk, doesn't fit in memory for the
// whole table at once). Measured real cardinality: 1,986 distinct
// (cubeOwnerUserId, cubeValue, cubeConfident) tuples across the whole
// table — between roll's 36 and sourcePositionId's 609k, but still
// globally batchable the same way roll's script is (accumulate ids per
// tuple across all game-batches, one updateMany per distinct tuple at the
// end). Idempotent via a value comparison against each row's current
// state, not a `WHERE ... IS NULL` pre-filter (same reasoning as roll's
// script).
//
// Usage:
//   npx tsx scripts/backfill-decision-cube-state.ts --dry-run   # compute + log only
//   npx tsx scripts/backfill-decision-cube-state.ts             # actually write
//
// Runs against whatever DATABASE_URL is currently configured in .env.
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import type { GameEvent } from "@/lib/gameReviewsTypes";
import { computeCubeStates } from "@/lib/cubeState";

const DRY_RUN = process.argv.includes("--dry-run");
const GAME_BATCH_SIZE = 300;

interface Row {
  id: number;
  gameId: number;
  eventId: bigint;
  raw: unknown;
  cubeOwnerUserId: string | null;
  cubeValue: number | null;
  cubeConfident: boolean | null;
}

interface CubeTuple {
  cubeOwnerUserId: string | null;
  cubeValue: number;
  cubeConfident: boolean;
}

// Matches lib/ingest.ts's own absolute-owner walk exactly (see that file's
// comment on Decision.cubeOwnerUserId).
function absoluteOwnerByEventId(events: GameEvent[]): Map<number, string | null> {
  const result = new Map<number, string | null>();
  let cubeOwner: string | null = null;
  for (const event of events) {
    const review = event.reviews?.[0];
    if (!review) continue;
    result.set(event.id, cubeOwner);
    if (review.result.analysed_event === "cube_pass" && review.take === true) {
      cubeOwner = event.user_id;
    }
  }
  return result;
}

function key(t: CubeTuple): string {
  return `${t.cubeOwnerUserId}:${t.cubeValue}:${t.cubeConfident}`;
}

function sameTuple(row: Row, t: CubeTuple): boolean {
  return row.cubeOwnerUserId === t.cubeOwnerUserId && row.cubeValue === t.cubeValue && row.cubeConfident === t.cubeConfident;
}

async function main() {
  console.log(DRY_RUN ? "DRY RUN — computing only, nothing will be written.\n" : "LIVE RUN — will write changes.\n");

  const games = await prisma.game.findMany({ select: { id: true }, orderBy: { id: "asc" } });
  console.log(`Games to process: ${games.length}`);

  const idsByKey = new Map<string, number[]>();
  const valueByKey = new Map<string, CubeTuple>();
  let processed = 0;
  let changed = 0;
  let unchanged = 0;

  for (let i = 0; i < games.length; i += GAME_BATCH_SIZE) {
    const gameIds = games.slice(i, i + GAME_BATCH_SIZE).map((g) => g.id);
    const rows: Row[] = await prisma.decision.findMany({
      where: { gameId: { in: gameIds } },
      select: {
        id: true,
        gameId: true,
        eventId: true,
        raw: true,
        cubeOwnerUserId: true,
        cubeValue: true,
        cubeConfident: true,
      },
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
      const owners = absoluteOwnerByEventId(events);
      const states = computeCubeStates(events);

      for (const row of gameRows) {
        processed++;
        const state = states.get(Number(row.eventId));
        if (!state) {
          // No usable review at this event — shouldn't happen for a stored
          // Decision row, but skip rather than guess if it ever does.
          continue;
        }
        const tuple: CubeTuple = {
          cubeOwnerUserId: owners.get(Number(row.eventId)) ?? null,
          cubeValue: state.value,
          cubeConfident: state.confident,
        };

        if (sameTuple(row, tuple)) {
          unchanged++;
          continue;
        }
        changed++;
        const k = key(tuple);
        valueByKey.set(k, tuple);
        const ids = idsByKey.get(k) ?? [];
        ids.push(row.id);
        idsByKey.set(k, ids);
      }
    }

    console.log(`... ${Math.min(i + GAME_BATCH_SIZE, games.length)}/${games.length} games`);
  }

  console.log(`\nDistinct (cubeOwnerUserId, cubeValue, cubeConfident) tuples to write: ${idsByKey.size}`);
  console.log(`Decisions: ${changed} would change, ${unchanged} already correct\n`);

  if (!DRY_RUN) {
    for (const [k, ids] of idsByKey) {
      const tuple = valueByKey.get(k)!;
      await prisma.decision.updateMany({
        where: { id: { in: ids } },
        data: tuple,
      });
      console.log(`Set ${JSON.stringify(tuple)} on ${ids.length} decisions`);
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
