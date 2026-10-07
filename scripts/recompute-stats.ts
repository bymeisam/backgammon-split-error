// Recomputes the two precomputed summary tables, MistakeStat and
// RepeatedPosition, from the current Decision rows. It's the same pair of calls
// lib/sync.ts makes at the end of every sync, runnable on its own. Use it after
// a backfill changes Decision data without a sync (e.g. the 2026-10-07 GNU
// Match ID backfills), so the stats match the corrected data.
//
// Each recompute replaces its table in full inside a transaction (see
// lib/recompute-mistake-stats.ts and lib/recompute-repeated-positions.ts). It's
// idempotent: re-running it on unchanged Decision data gives the same rows with
// a new computedAt.
//
// Usage:
//   npx tsx scripts/recompute-stats.ts --dry-run   # print current totals only
//   npx tsx scripts/recompute-stats.ts             # recompute, print before/after
//
// Runs against whatever DATABASE_URL is currently configured in .env.
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { recomputeMistakeStats } from "@/lib/recompute-mistake-stats";
import { recomputeRepeatedPositions } from "@/lib/recompute-repeated-positions";

const DRY_RUN = process.argv.includes("--dry-run");

async function totals() {
  const mistake = await prisma.mistakeStat.groupBy({
    by: ["errorSeverity"],
    _count: { _all: true },
    _sum: { decisionCount: true },
    orderBy: { errorSeverity: "asc" },
  });
  const repeated = await prisma.repeatedPosition.groupBy({
    by: ["errorSeverity"],
    _count: { _all: true },
    _sum: { occurrenceCount: true },
    orderBy: { errorSeverity: "asc" },
  });
  return {
    MistakeStat: mistake.map((r) => `${r.errorSeverity}: ${r._count._all} rows / ${r._sum.decisionCount ?? 0} decisions`),
    RepeatedPosition: repeated.map((r) => `${r.errorSeverity}: ${r._count._all} rows / ${r._sum.occurrenceCount ?? 0} occurrences`),
  };
}

function print(label: string, t: Awaited<ReturnType<typeof totals>>) {
  console.log(`\n=== ${label} ===`);
  for (const [table, lines] of Object.entries(t)) {
    console.log(`${table}:`);
    for (const line of lines) console.log(`  ${line}`);
  }
}

async function main() {
  const host = new URL(process.env.DATABASE_URL ?? "mysql://unset").host;
  console.log(`${DRY_RUN ? "DRY RUN — nothing will be written." : "LIVE RUN — will recompute both tables."} Target: ${host}`);

  print("Before", await totals());
  if (DRY_RUN) {
    console.log("\n(dry run — nothing was written)");
    return;
  }

  const t0 = Date.now();
  await recomputeMistakeStats();
  console.log(`\nMistakeStat recomputed (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  const t1 = Date.now();
  await recomputeRepeatedPositions();
  console.log(`RepeatedPosition recomputed (${((Date.now() - t1) / 1000).toFixed(1)}s)`);

  print("After", await totals());
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
