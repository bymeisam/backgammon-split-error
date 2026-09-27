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
// sourcePositionId isn't a real Decision column — it lives inside the raw
// JSON blob (reviews[0].source_position.formatted_value; NOT
// moves[].final.gnubgid, which is a per-candidate *destination* position,
// confirmed by direct inspection during investigation), so it can't be
// grouped via Prisma's groupBy() the way MistakeStat's classification/kind/
// errorSeverity can (those are real indexed columns).
//
// Deliberately NOT a grouped SQL query (e.g. GROUP BY ... with
// COUNT(DISTINCT JSON_EXTRACT(...))) — measured that shape at 341 seconds
// for just 4 groups (errorSeverity), because MySQL has no index on the
// JSON-extracted expression and re-scans/re-sorts per group. Measured
// instead that a single UNAGGREGATED extraction — no GROUP BY, no DISTINCT,
// just SELECT the three fields for every matching row — returns all
// ~502k rows in about 2 seconds; grouping/counting then happens in JS
// (a plain Map), which is fast at this row count. One full-table pass
// instead of a per-group scan is the whole difference.
import { prisma } from "@/lib/prisma";
import { ErrorSeverity } from "@/lib/generated/prisma/client";

interface RawRow {
  sourcePositionId: string | null;
  classification: string;
  errorSeverity: ErrorSeverity;
}

export async function recomputeRepeatedPositions(): Promise<void> {
  const rows = await prisma.$queryRaw<RawRow[]>`
    SELECT
      JSON_UNQUOTE(JSON_EXTRACT(raw, '$.reviews[0].source_position.formatted_value')) AS sourcePositionId,
      classification,
      errorSeverity
    FROM Decision
    WHERE kind = 'CHECKER' AND countAsDecision = 1 AND rawError IS NOT NULL
  `;

  const groups = new Map<
    string,
    { sourcePositionId: string; classification: string; errorSeverity: ErrorSeverity; count: number }
  >();

  for (const row of rows) {
    // Confirmed 0 missing across the whole relevant population during
    // investigation — this guard is a safety net, not an expected path.
    if (!row.sourcePositionId) continue;

    const key = `${row.sourcePositionId}:${row.errorSeverity}`;
    const existing = groups.get(key);
    if (existing) {
      existing.count++;
    } else {
      groups.set(key, {
        sourcePositionId: row.sourcePositionId,
        classification: row.classification,
        errorSeverity: row.errorSeverity,
        count: 1,
      });
    }
  }

  const computedAt = new Date();
  // Only real repeats — a position/severity pair seen exactly once isn't a
  // "repeated position" at all, and keeping it here would make this table
  // roughly the size of Decision itself instead of the small, genuinely
  // interesting subset it's meant to be.
  const data = [...groups.values()]
    .filter((g) => g.count > 1)
    .map((g) => ({
      sourcePositionId: g.sourcePositionId,
      classification: g.classification,
      errorSeverity: g.errorSeverity,
      occurrenceCount: g.count,
      computedAt,
    }));

  await prisma.$transaction([
    prisma.repeatedPosition.deleteMany({}),
    prisma.repeatedPosition.createMany({ data }),
  ]);
}
