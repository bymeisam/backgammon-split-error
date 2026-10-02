// One-time backfill: computes Decision.cubeActionPlayed/cubeActionBest for
// every already-ingested CUBE-kind row, entirely from data already in the
// local DB — no live Galaxy calls. Needed because these columns are new
// (reports/2026-10-02-raw-field-reverification.md, replacing the old
// cubeDetail column) — every row ingested before lib/ingest.ts started
// populating them has both null.
//
// Rule (matches lib/mistakes.ts's actionLabels() exactly, for the two
// analysed_event shapes that reach CUBE kind):
//   cube_double: played = review.double ? "doubled" : "did not double";
//                best   = cube_analysis.doublers_best_action, "_" -> " ".
//   cube_pass:   played = review.take ? "took" : "passed";
//                best   = cube_analysis.receivers_best_action, "_" -> " ".
//
// Single-row computation (no cross-row game context needed, unlike roll/
// cubeState's backfills) — same category as sourcePositionId's backfill,
// so a single server-side UPDATE with a CASE on the already-stored
// analysedEvent column does the whole table in one pass, no batching/OOM
// risk the way a JS-side walk of 664,579 CUBE rows' raw JSON would risk.
//
// Usage:
//   npx tsx scripts/backfill-cube-action-labels.ts --dry-run   # count only
//   npx tsx scripts/backfill-cube-action-labels.ts             # actually write
//
// Idempotent: WHERE cubeActionPlayed IS NULL scopes every run to only rows
// that still need it.
//
// Runs against whatever DATABASE_URL is currently configured in .env.
import "dotenv/config";
import { prisma } from "@/lib/prisma";

const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  console.log(DRY_RUN ? "DRY RUN — counting only, nothing will be written.\n" : "LIVE RUN — will write changes.\n");

  const totalNull = await prisma.decision.count({ where: { kind: "CUBE", cubeActionPlayed: null } });
  console.log(`CUBE-kind decisions with cubeActionPlayed still null (before): ${totalNull}`);

  const [{ resolvable }] = await prisma.$queryRaw<{ resolvable: bigint }[]>`
    SELECT COUNT(*) AS resolvable FROM Decision
    WHERE kind = 'CUBE' AND cubeActionPlayed IS NULL
      AND analysedEvent IN ('cube_double', 'cube_pass')
  `;
  console.log(`Resolvable (analysedEvent is cube_double/cube_pass): ${resolvable}`);
  console.log(`Unresolvable (unexpected analysedEvent for CUBE kind — shouldn't happen): ${totalNull - Number(resolvable)}\n`);

  if (!DRY_RUN) {
    const result = await prisma.$executeRaw`
      UPDATE Decision
      SET
        cubeActionPlayed = CASE
          WHEN analysedEvent = 'cube_double' THEN
            CASE WHEN JSON_EXTRACT(raw, '$.reviews[0].double') = true THEN 'doubled' ELSE 'did not double' END
          WHEN analysedEvent = 'cube_pass' THEN
            CASE WHEN JSON_EXTRACT(raw, '$.reviews[0].take') = true THEN 'took' ELSE 'passed' END
          ELSE NULL
        END,
        cubeActionBest = CASE
          WHEN analysedEvent = 'cube_double' THEN
            REPLACE(JSON_UNQUOTE(JSON_EXTRACT(raw, '$.reviews[0].result.result.cube_analysis.doublers_best_action')), '_', ' ')
          WHEN analysedEvent = 'cube_pass' THEN
            REPLACE(JSON_UNQUOTE(JSON_EXTRACT(raw, '$.reviews[0].result.result.cube_analysis.receivers_best_action')), '_', ' ')
          ELSE NULL
        END
      WHERE kind = 'CUBE' AND cubeActionPlayed IS NULL
    `;
    console.log(`Rows updated: ${result}`);
  }

  const remainingNull = await prisma.decision.count({ where: { kind: "CUBE", cubeActionPlayed: null } });

  console.log("\n=== Summary ===");
  console.log(DRY_RUN ? "(dry run — nothing was written)" : "(live run — changes above were written)");
  console.log(`cubeActionPlayed still null after this run: ${remainingNull} (expected: 0 if DRY_RUN is false and unresolvable was 0)`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
