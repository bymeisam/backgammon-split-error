import Link from "next/link";
import { prismaReadOnly as prisma } from "@/lib/prisma";
import { ErrorSeverity } from "@/lib/generated/prisma/client";

// Server component, queried fresh on every request (no caching) — same
// "reflect current DB state" requirement /status follows.
export const dynamic = "force-dynamic";

interface Breakdown {
  label: string;
  total: number;
  blunderCount: number;
  errorCount: number;
  doubtfulCount: number;
  avgAbsError: number;
}

// Raw driver types for these aggregates aren't plain JS numbers: COUNT(*)
// comes back as bigint, and SUM(CASE...) comes back as a Decimal-like object
// (constructor name "Decimal2") — both coerce correctly through Number(),
// confirmed directly against real data before writing this, not assumed.
interface RawBreakdownRow {
  label: string;
  total: bigint;
  blunderCount: unknown;
  errorCount: unknown;
  doubtfulCount: unknown;
  avgAbsError: number | null;
}

function normalize(rows: RawBreakdownRow[]): Breakdown[] {
  return rows.map((r) => ({
    label: r.label,
    total: Number(r.total),
    blunderCount: Number(r.blunderCount),
    errorCount: Number(r.errorCount),
    doubtfulCount: Number(r.doubtfulCount),
    avgAbsError: r.avgAbsError ?? 0,
  }));
}

// Both queries share the same WHERE clause: countAsDecision = true (an
// event Galaxy itself flags as a real decision, not just outcome-logging)
// AND rawError IS NOT NULL (has a real graded magnitude to average). AVG on
// a signed rawError would let positive/negative errors cancel out, which
// isn't "how big are the mistakes here" — ABS() first, per the ask.

async function getByClassification(): Promise<Breakdown[]> {
  const rows = await prisma.$queryRaw<RawBreakdownRow[]>`
    SELECT
      classification AS label,
      COUNT(*) AS total,
      SUM(CASE WHEN errorSeverity = ${ErrorSeverity.BLUNDER} THEN 1 ELSE 0 END) AS blunderCount,
      SUM(CASE WHEN errorSeverity = ${ErrorSeverity.ERROR} THEN 1 ELSE 0 END) AS errorCount,
      SUM(CASE WHEN errorSeverity = ${ErrorSeverity.DOUBTFUL} THEN 1 ELSE 0 END) AS doubtfulCount,
      AVG(ABS(rawError)) AS avgAbsError
    FROM \`Decision\`
    WHERE countAsDecision = true AND rawError IS NOT NULL
    GROUP BY classification
    ORDER BY total DESC
  `;
  return normalize(rows);
}

// kind (CHECKER/CUBE/RESIGNATION) is the schema's own clean split for
// checker-play vs. cube decisions — DecisionKind is set from analysed_event
// at ingest time (move -> CHECKER, cube_double/cube_pass -> CUBE,
// resignation -> RESIGNATION), so grouping by it directly is equivalent to
// re-deriving the same split from analysedEvent, without duplicating that
// logic. RESIGNATION is included as its own row (not dropped) so the totals
// here fully account for every row the shared WHERE clause matches.
async function getByKind(): Promise<Breakdown[]> {
  const rows = await prisma.$queryRaw<RawBreakdownRow[]>`
    SELECT
      CASE kind
        WHEN 'CHECKER' THEN 'Checker play'
        WHEN 'CUBE' THEN 'Cube decisions'
        WHEN 'RESIGNATION' THEN 'Resignations'
        ELSE kind
      END AS label,
      COUNT(*) AS total,
      SUM(CASE WHEN errorSeverity = ${ErrorSeverity.BLUNDER} THEN 1 ELSE 0 END) AS blunderCount,
      SUM(CASE WHEN errorSeverity = ${ErrorSeverity.ERROR} THEN 1 ELSE 0 END) AS errorCount,
      SUM(CASE WHEN errorSeverity = ${ErrorSeverity.DOUBTFUL} THEN 1 ELSE 0 END) AS doubtfulCount,
      AVG(ABS(rawError)) AS avgAbsError
    FROM \`Decision\`
    WHERE countAsDecision = true AND rawError IS NOT NULL
    GROUP BY kind
    ORDER BY FIELD(kind, 'CHECKER', 'CUBE', 'RESIGNATION')
  `;
  return normalize(rows);
}

function BreakdownTable({ labelHeader, rows }: { labelHeader: string; rows: Breakdown[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/15">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-black/10 bg-zinc-100 text-xs uppercase tracking-wide text-zinc-500 dark:border-white/15 dark:bg-zinc-900 dark:text-zinc-400">
            <th className="px-3 py-2">{labelHeader}</th>
            <th className="px-3 py-2">Total</th>
            <th className="px-3 py-2">Blunders</th>
            <th className="px-3 py-2">Errors</th>
            <th className="px-3 py-2">Doubtful</th>
            <th className="px-3 py-2">Avg |error|</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.label}
              className="border-b border-black/5 last:border-b-0 dark:border-white/10"
            >
              <td className="px-3 py-2 text-black dark:text-zinc-100">{r.label}</td>
              <td className="px-3 py-2 font-mono text-xs text-black dark:text-zinc-100">
                {r.total.toLocaleString()}
              </td>
              <td className="px-3 py-2 font-mono text-xs text-black dark:text-zinc-100">
                {r.blunderCount.toLocaleString()}
              </td>
              <td className="px-3 py-2 font-mono text-xs text-black dark:text-zinc-100">
                {r.errorCount.toLocaleString()}
              </td>
              <td className="px-3 py-2 font-mono text-xs text-black dark:text-zinc-100">
                {r.doubtfulCount.toLocaleString()}
              </td>
              <td className="px-3 py-2 font-mono text-xs text-black dark:text-zinc-100">
                {r.avgAbsError.toFixed(4)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function MatchesAnalysisPage() {
  const [byClassification, byKind] = await Promise.all([getByClassification(), getByKind()]);

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 dark:bg-black">
      <main className="flex w-full max-w-4xl flex-col gap-8 px-6 py-12">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
            Mistake pattern analysis
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Error concentration across every ingested decision that counts
            (<code>countAsDecision = true</code>, <code>rawError</code>{" "}
            populated) — queried live on every load, so this reflects the
            current DB as more matches get ingested.{" "}
            <Link href="/matches" className="underline hover:text-black dark:hover:text-zinc-100">
              ← back to matches
            </Link>
          </p>
        </div>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-black dark:text-zinc-50">
            Error concentration by game phase
          </h2>
          <BreakdownTable labelHeader="Classification" rows={byClassification} />
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-black dark:text-zinc-50">
            Cube errors vs. checker-play errors
          </h2>
          <BreakdownTable labelHeader="Decision type" rows={byKind} />
        </section>
      </main>
    </div>
  );
}
