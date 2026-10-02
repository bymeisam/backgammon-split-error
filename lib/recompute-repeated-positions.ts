// Recomputes RepeatedPosition in full from current Decision data — not an
// incremental upsert. Same self-correcting design as
// lib/recompute-mistake-stats.ts (called alongside it from lib/sync.ts's
// runSync, after all matches in a run finish): a full DELETE + bulk-insert
// replace inside one transaction, so it self-corrects after any retroactive
// fix to the underlying Decision data instead of accumulating drift.
//
// CHECKER decisions only (kind: 'CHECKER') — cube decisions have no
// comparable "same board, multiple candidate moves" framing (confirmed
// during investigation), so they're excluded from this table entirely.
//
// sourcePositionId is now a real, indexed Decision column
// (Decision_sourcePositionId_errorSeverity_idx — see
// reports/2026-10-02-step3-sourcepositionid-column-design.md), but that
// index doesn't help *this* query: its WHERE clause filters on
// kind/countAsDecision/rawError, none of which share a prefix with
// (sourcePositionId, errorSeverity), so grouping by that pair still can't
// be satisfied by an index scan — it would still need a temp table +
// filesort over the matched rows either way.
//
// Deliberately NOT a grouped SQL query (e.g. GROUP BY ... with
// COUNT(DISTINCT sourcePositionId)) for exactly that reason — measured that
// shape at 341 seconds for just 4 groups (errorSeverity) back when
// sourcePositionId was an unindexed JSON_EXTRACT expression, and the
// column doesn't change the fundamental mismatch between this query's
// filter columns and its grouping columns. Measured instead that a single
// UNAGGREGATED extraction — no GROUP BY, no DISTINCT, just SELECT the three
// fields for every matching row — returns all ~502k rows in about 2
// seconds; grouping/counting then happens in JS (a plain Map), which is
// fast at this row count. One full-table pass instead of a per-group scan
// is the whole difference. The column's actual win here is a cheaper
// per-row projection (a plain column read instead of a JSON_EXTRACT/
// JSON_UNQUOTE call, ~502k times) — not a different query shape.
import { prisma } from "@/lib/prisma";
import { ErrorSeverity } from "@/lib/generated/prisma/client";

interface RawRow {
  sourcePositionId: string | null;
  classification: string;
  errorSeverity: ErrorSeverity;
  // Real Decision column now (see Decision.plyNumber's schema comment) —
  // grouped alongside sourcePositionId/errorSeverity below as an
  // independent dimension. A real position within the first 4 plies always
  // arises at the same fixed ply across every occurrence (see
  // RepeatedPosition.plyNumber's own schema comment), so this refines
  // existing groups rather than fragmenting them.
  plyNumber: number | null;
}

export async function recomputeRepeatedPositions(): Promise<void> {
  const rows: RawRow[] = await prisma.decision.findMany({
    where: { kind: "CHECKER", countAsDecision: true, rawError: { not: null } },
    select: { sourcePositionId: true, classification: true, errorSeverity: true, plyNumber: true },
  });

  const groups = new Map<
    string,
    {
      sourcePositionId: string;
      classification: string;
      errorSeverity: ErrorSeverity;
      plyNumber: number | null;
      count: number;
    }
  >();

  for (const row of rows) {
    // Confirmed 0 missing across the whole relevant population during
    // investigation — this guard is a safety net, not an expected path.
    if (!row.sourcePositionId) continue;

    const key = `${row.sourcePositionId}:${row.errorSeverity}:${row.plyNumber ?? "null"}`;
    const existing = groups.get(key);
    if (existing) {
      existing.count++;
    } else {
      groups.set(key, {
        sourcePositionId: row.sourcePositionId,
        classification: row.classification,
        errorSeverity: row.errorSeverity,
        plyNumber: row.plyNumber,
        count: 1,
      });
    }
  }

  const computedAt = new Date();
  // Only real repeats — a position/severity/ply combination seen exactly
  // once isn't a "repeated position" at all, and keeping it here would make
  // this table roughly the size of Decision itself instead of the small,
  // genuinely interesting subset it's meant to be.
  const data = [...groups.values()]
    .filter((g) => g.count > 1)
    .map((g) => ({
      sourcePositionId: g.sourcePositionId,
      classification: g.classification,
      errorSeverity: g.errorSeverity,
      plyNumber: g.plyNumber,
      occurrenceCount: g.count,
      computedAt,
    }));

  await prisma.$transaction([
    prisma.repeatedPosition.deleteMany({}),
    prisma.repeatedPosition.createMany({ data }),
  ]);
}
