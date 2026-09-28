// One-time backfill: computes Decision.plyNumber for every already-ingested
// game, entirely from data already in the local DB — no live Galaxy calls.
// Needed because lib/ingest.ts's ply-number computation (see its own
// comment, and docs/field-mapping.md's "Ply number" section) didn't exist
// before this change — every match ingested before it has plyNumber: null
// on every Decision row.
//
// Rule (matches lib/ingest.ts's checkerPlyByEventId exactly): for each
// gameId, order its kind = 'CHECKER' decisions by eventId ascending, assign
// plyNumber 1/2/3/4 to the first four, null beyond.
//
// Deviates from scripts/backfill-played-at.ts's own pattern in one way
// worth calling out: that script re-parses Decision.raw's JSON because its
// rule (first decision *with a populated error_analysis*) isn't already
// fully captured by any real Decision column. Ply number's rule doesn't
// have that gap — a stored Decision row's mere existence with kind =
// 'CHECKER' already means error_analysis was non-null at ingest time (see
// docs/field-mapping.md's "Events skipped via null error_analysis": a null-
// error_analysis event never gets a row at all), so kind/eventId (real,
// already-indexed columns) are a complete and equivalent source — no need
// to re-parse raw JSON for this one.
//
// One full-table extraction (all kind = 'CHECKER' decisions, a handful of
// real columns only) + grouping/computation in a plain JS Map, then a
// handful of batched updateMany calls (one per target plyNumber value) —
// not a per-game round trip, and not a per-row update. Same "one full pass
// beats many small queries" lesson as lib/recompute-repeated-positions.ts.
//
// Usage:
//   npx tsx scripts/backfill-ply-number.ts --dry-run   # compute + log only
//   npx tsx scripts/backfill-ply-number.ts             # actually write
//
// Runs against whatever DATABASE_URL is currently configured in .env.
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { DecisionKind } from "@/lib/generated/prisma/client";

const DRY_RUN = process.argv.includes("--dry-run");
const MAX_TRACKED_PLY = 4;

interface Row {
  id: number;
  gameId: number;
  eventId: bigint;
  plyNumber: number | null;
}

function countsByPly(rows: { plyNumber: number | null }[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const r of rows) {
    const key = r.plyNumber === null ? "null" : String(r.plyNumber);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function formatCounts(counts: Record<string, number>): string {
  const order = ["1", "2", "3", "4", "null"];
  return order
    .filter((k) => k in counts)
    .map((k) => `${k === "null" ? "null (>4 or n/a)" : `ply ${k}`}: ${counts[k]}`)
    .join(", ");
}

async function main() {
  console.log(DRY_RUN ? "DRY RUN — computing only, nothing will be written.\n" : "LIVE RUN — will write changes.\n");

  const rows: Row[] = await prisma.decision.findMany({
    where: { kind: DecisionKind.CHECKER },
    select: { id: true, gameId: true, eventId: true, plyNumber: true },
    orderBy: [{ gameId: "asc" }, { eventId: "asc" }],
  });
  console.log(`CHECKER decisions found: ${rows.length}\n`);
  console.log(`Before: ${formatCounts(countsByPly(rows))}`);

  const byGame = new Map<number, Row[]>();
  for (const row of rows) {
    const group = byGame.get(row.gameId);
    if (group) group.push(row);
    else byGame.set(row.gameId, [row]);
  }

  // ids bucketed by their computed plyNumber, but only where it actually
  // differs from what's currently stored — so a re-run (e.g. after fixing a
  // bug in this script, or applying it again after a future ingest-time
  // change) doesn't rewrite rows that are already correct.
  const idsToSet = new Map<number | null, number[]>([[1, []], [2, []], [3, []], [4, []], [null, []]]);
  const afterRows: { plyNumber: number | null }[] = [];
  let changed = 0;
  let unchanged = 0;

  for (const group of byGame.values()) {
    // Already ordered by eventId ascending via the query's orderBy, but
    // sorted again defensively — this is the one invariant the whole
    // computation depends on.
    group.sort((a, b) => (a.eventId < b.eventId ? -1 : a.eventId > b.eventId ? 1 : 0));

    group.forEach((row, index) => {
      const newPly = index < MAX_TRACKED_PLY ? index + 1 : null;
      afterRows.push({ plyNumber: newPly });
      if (row.plyNumber === newPly) {
        unchanged++;
        return;
      }
      changed++;
      idsToSet.get(newPly)!.push(row.id);
    });
  }

  console.log(`After:  ${formatCounts(countsByPly(afterRows))}\n`);
  console.log(`Decisions: ${changed} would change, ${unchanged} already correct\n`);

  if (!DRY_RUN) {
    for (const [plyNumber, ids] of idsToSet) {
      if (ids.length === 0) continue;
      await prisma.decision.updateMany({ where: { id: { in: ids } }, data: { plyNumber } });
      console.log(`Set plyNumber = ${plyNumber ?? "null"} on ${ids.length} decisions`);
    }
  }

  console.log("\n=== Summary ===");
  console.log(DRY_RUN ? "(dry run — nothing was written)" : "(live run — changes above were written)");
  console.log(`Games processed: ${byGame.size}`);
  console.log(`Decisions: ${rows.length} total, ${changed} changed, ${unchanged} unchanged`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
