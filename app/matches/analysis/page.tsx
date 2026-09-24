import Link from "next/link";
import { prismaReadOnly as prisma } from "@/lib/prisma";
import { ErrorSeverity, type MistakeStat } from "@/lib/generated/prisma/client";

// Server component, queried fresh on every request (no caching) — same
// "reflect current DB state" requirement /status follows. Reads only
// MistakeStat (small, precomputed by lib/recompute-mistake-stats.ts at the
// end of every sync run — see lib/sync.ts) — no aggregation against the
// much larger Decision table happens here at read time.
export const dynamic = "force-dynamic";

interface Row {
  key: string;
  total: number;
  blunderCount: number;
  errorCount: number;
  doubtfulCount: number;
  noneCount: number;
}

// Aggregates MistakeStat rows across whichever dimension isn't `keyOf`
// (classification for Section 1, category for Section 2) in memory, here in
// the page — MistakeStat's own unique key is (classification, category,
// errorSeverity), one row narrower than what either section needs. One row
// per key, with each severity's count pivoted into its own column — no
// classification/category value is ever named here: the set of rows (and
// their sort order by total decisionCount) comes entirely from whatever
// MistakeStat actually contains. errorSeverity itself is a real, finite
// Prisma enum (4 known values), so pivoting it into fixed columns isn't the
// kind of hardcoded classification/category taxonomy that rule is about.
function aggregateBy(stats: MistakeStat[], keyOf: (s: MistakeStat) => string): Row[] {
  const buckets = new Map<string, Row>();
  for (const s of stats) {
    const key = keyOf(s);
    const bucket = buckets.get(key) ?? {
      key,
      total: 0,
      blunderCount: 0,
      errorCount: 0,
      doubtfulCount: 0,
      noneCount: 0,
    };
    bucket.total += s.decisionCount;
    switch (s.errorSeverity) {
      case ErrorSeverity.BLUNDER:
        bucket.blunderCount += s.decisionCount;
        break;
      case ErrorSeverity.ERROR:
        bucket.errorCount += s.decisionCount;
        break;
      case ErrorSeverity.DOUBTFUL:
        bucket.doubtfulCount += s.decisionCount;
        break;
      case ErrorSeverity.NONE:
        bucket.noneCount += s.decisionCount;
        break;
    }
    buckets.set(key, bucket);
  }

  // Ordered by total decisionCount descending — data-driven, whatever
  // classification/category values are actually most common.
  return [...buckets.values()].sort((a, b) => b.total - a.total);
}

// Which /mistakes query param this table's `key` values feed — classifications
// use `classification=<value>` verbatim, categories use `category=<lowercased
// enum value>` (app/mistakes/page.tsx maps "checker"/"cube"/"resignation"
// back to the DecisionKind enum).
function mistakesHref(paramName: "classification" | "category", key: string, severity?: string): string {
  const value = paramName === "category" ? key.toLowerCase() : key;
  const sp = new URLSearchParams({ [paramName]: value });
  if (severity) sp.set("severity", severity);
  return `/mistakes?${sp.toString()}`;
}

function CountLink({ href, count }: { href: string; count: number }) {
  return (
    <Link href={href} className="hover:underline hover:text-black dark:hover:text-zinc-100">
      {count.toLocaleString()}
    </Link>
  );
}

function BreakdownTable({
  keyHeader,
  paramName,
  rows,
}: {
  keyHeader: string;
  paramName: "classification" | "category";
  rows: Row[];
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/15">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-black/10 bg-zinc-100 text-xs uppercase tracking-wide text-zinc-500 dark:border-white/15 dark:bg-zinc-900 dark:text-zinc-400">
            <th className="px-3 py-2">{keyHeader}</th>
            <th className="px-3 py-2">Blunders</th>
            <th className="px-3 py-2">Errors</th>
            <th className="px-3 py-2">Doubtful</th>
            <th className="px-3 py-2">Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.key}
              className="border-b border-black/5 last:border-b-0 dark:border-white/10"
            >
              <td className="px-3 py-2 text-black dark:text-zinc-100">{r.key}</td>
              <td className="px-3 py-2 font-mono text-xs text-black dark:text-zinc-100">
                <CountLink href={mistakesHref(paramName, r.key, "blunder")} count={r.blunderCount} />
              </td>
              <td className="px-3 py-2 font-mono text-xs text-black dark:text-zinc-100">
                <CountLink href={mistakesHref(paramName, r.key, "error")} count={r.errorCount} />
              </td>
              <td className="px-3 py-2 font-mono text-xs text-black dark:text-zinc-100">
                <CountLink href={mistakesHref(paramName, r.key, "doubtful")} count={r.doubtfulCount} />
              </td>
              <td className="px-3 py-2 font-mono text-xs text-black dark:text-zinc-100">
                <CountLink href={mistakesHref(paramName, r.key)} count={r.total} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function MatchesAnalysisPage() {
  const stats = await prisma.mistakeStat.findMany();

  const byClassification = aggregateBy(stats, (s) => s.classification);
  const byCategory = aggregateBy(stats, (s) => s.category);

  const computedAt = stats[0]?.computedAt ?? null;

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 dark:bg-black">
      <main className="flex w-full max-w-4xl flex-col gap-8 px-6 py-12">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
            Mistake pattern analysis
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Precomputed from every counted decision with a graded error,
            recomputed in full at the end of every sync run. Total includes
            all severities (including no-mistake decisions); Blunders/
            Errors/Doubtful break that down.
            {computedAt && <> Last computed {computedAt.toISOString()}.</>}{" "}
            <Link href="/matches" className="underline hover:text-black dark:hover:text-zinc-100">
              ← back to matches
            </Link>
          </p>
        </div>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-black dark:text-zinc-50">
            Error concentration by game phase
          </h2>
          <BreakdownTable keyHeader="Classification" paramName="classification" rows={byClassification} />
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-black dark:text-zinc-50">
            Cube errors vs. checker-play errors
          </h2>
          <BreakdownTable keyHeader="Category" paramName="category" rows={byCategory} />
        </section>
      </main>
    </div>
  );
}
