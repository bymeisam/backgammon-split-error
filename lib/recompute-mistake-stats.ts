// Recomputes MistakeStat in full from current Decision data — not an
// incremental upsert. Called once at the end of every runSync (lib/sync.ts),
// after all matches in that run have finished, so it self-corrects after any
// retroactive fix to the underlying Decision data (e.g. this session's
// rawError/playedAt corrections) instead of accumulating drift from a stale
// partial update.
//
// sumAbsRawError is Math.abs() applied to the already-aggregated
// SUM(rawError) from Prisma's groupBy() — not SUM(ABS(rawError)) computed
// row-by-row in SQL, which groupBy() has no way to express (its _sum only
// takes a plain field, never a wrapped expression). Verified against real
// data this isn't a shortcut, not assumed: every rawError value in the
// entire Decision table outside errorSeverity: NONE is <= 0 — the only 90
// positive rawError rows that exist are all errorSeverity: NONE ("no real
// mistake" rows). So ABS(SUM(x)) and SUM(ABS(x)) are mathematically
// identical for every severity bucket that actually matters (BLUNDER/ERROR/
// DOUBTFUL), and negligibly different for NONE.
import { prisma } from "@/lib/prisma";

export async function recomputeMistakeStats(): Promise<void> {
  const results = await prisma.decision.groupBy({
    by: ["classification", "kind", "errorSeverity"],
    where: { countAsDecision: true, rawError: { not: null } },
    _count: { _all: true },
    _sum: { rawError: true },
  });

  const computedAt = new Date();
  const rows = results.map((r) => ({
    classification: r.classification,
    category: r.kind,
    errorSeverity: r.errorSeverity,
    decisionCount: r._count._all,
    sumAbsRawError: Math.abs(r._sum.rawError ?? 0),
    computedAt,
  }));

  await prisma.$transaction([
    prisma.mistakeStat.deleteMany({}),
    prisma.mistakeStat.createMany({ data: rows }),
  ]);
}
