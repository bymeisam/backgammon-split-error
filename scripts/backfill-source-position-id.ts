// One-time backfill: computes Decision.sourcePositionId for every
// already-ingested row, entirely from data already in the local DB — no
// live Galaxy calls. Needed because lib/ingest.ts only started populating
// this column going forward (see its own comment next to the
// sourcePositionId field) — every row ingested before that change has
// sourcePositionId: null.
//
// Rule (matches lib/ingest.ts exactly): review.source_position.formatted_value
// from the row's own raw JSON. Confirmed 100% real-data coverage across all
// 1,257,534 rows and all three kinds before this script was written (see
// reports/2026-10-02-step3-sourcepositionid-column-design.md) — every row
// has a reviews[0] and a non-null source_position.formatted_value, so no
// row is expected to be left null after this runs.
//
// Full scope deliberately includes every kind (CHECKER/CUBE/RESIGNATION),
// not just the CHECKER/countAsDecision subset the two consuming queries
// (findPositionOccurrences, recomputeRepeatedPositions) filter on —
// decisionFromRow/decisionFromRowForReplay/extractDecisions all read this
// value unconditionally on every kind for display.
//
// Unlike scripts/backfill-ply-number.ts's shape (pull rows into JS, group,
// write a handful of updateMany calls) — that only works because plyNumber
// has 5 possible output values. sourcePositionId has 609,305 distinct
// values across this table, so that same shape means either materializing
// ~1.26M rows' full raw JSON in Node at once (measured: reliably crashes
// with a heap-out-of-memory error) or ~609k individual updateMany round
// trips (measured: still running after several minutes, nowhere close to
// done). A single server-side UPDATE computing the value in the same
// statement that writes it avoids both — MySQL does the JSON extraction
// and the write in one pass per row, no round trip or materialization
// per value.
//
// Usage:
//   npx tsx scripts/backfill-source-position-id.ts --dry-run   # count only
//   npx tsx scripts/backfill-source-position-id.ts             # actually write
//
// Idempotent: WHERE sourcePositionId IS NULL scopes every run (including
// this one, picking up where an earlier interrupted JS-loop version of
// this script left off) to only the rows that still need it.
//
// Runs against whatever DATABASE_URL is currently configured in .env.
import "dotenv/config";
import { prisma } from "@/lib/prisma";

const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  console.log(DRY_RUN ? "DRY RUN — counting only, nothing will be written.\n" : "LIVE RUN — will write changes.\n");

  const totalNull = await prisma.decision.count({ where: { sourcePositionId: null } });
  console.log(`Decisions with sourcePositionId still null (before): ${totalNull}`);

  const [{ resolvable }] = await prisma.$queryRaw<{ resolvable: bigint }[]>`
    SELECT COUNT(*) AS resolvable FROM Decision
    WHERE sourcePositionId IS NULL
      AND JSON_UNQUOTE(JSON_EXTRACT(raw, '$.reviews[0].source_position.formatted_value')) IS NOT NULL
  `;
  console.log(`Resolvable from raw (before): ${resolvable}`);
  console.log(`Unresolvable (no reviews[0]/source_position, before): ${totalNull - Number(resolvable)}\n`);

  if (!DRY_RUN) {
    const result = await prisma.$executeRaw`
      UPDATE Decision
      SET sourcePositionId = JSON_UNQUOTE(JSON_EXTRACT(raw, '$.reviews[0].source_position.formatted_value'))
      WHERE sourcePositionId IS NULL
    `;
    console.log(`Rows updated: ${result}`);
  }

  const remainingNull = await prisma.decision.count({ where: { sourcePositionId: null } });

  console.log("\n=== Summary ===");
  console.log(DRY_RUN ? "(dry run — nothing was written)" : "(live run — changes above were written)");
  console.log(`sourcePositionId still null after this run: ${remainingNull} (expected: 0 if DRY_RUN is false and unresolvable was 0)`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
