import { Suspense } from "react";
import Link from "next/link";
import { prismaReadOnly as prisma } from "@/lib/prisma";
import {
  DecisionKind as PrismaDecisionKind,
  ErrorSeverity as PrismaErrorSeverity,
} from "@/lib/generated/prisma/client";
import { decisionFromRow, buildRollLookup } from "@/lib/decisionFromRow";
import DecisionListWithDetail from "@/app/components/match-analysis/DecisionListWithDetail";

// Server component, queried fresh on every request (no caching) — same
// pattern /status and /matches/analysis already use. prismaReadOnly
// throughout: pure read feature, no writes.
export const dynamic = "force-dynamic";

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;
const DEFAULT_PAGE_SIZE = 10;

const SEVERITY_PARAM_MAP: Record<string, PrismaErrorSeverity> = {
  blunder: PrismaErrorSeverity.BLUNDER,
  error: PrismaErrorSeverity.ERROR,
  doubtful: PrismaErrorSeverity.DOUBTFUL,
  none: PrismaErrorSeverity.NONE,
};

const CATEGORY_PARAM_MAP: Record<string, PrismaDecisionKind> = {
  checker: PrismaDecisionKind.CHECKER,
  cube: PrismaDecisionKind.CUBE,
  resignation: PrismaDecisionKind.RESIGNATION,
};

function buildQueryString(params: Record<string, string | undefined>): string {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) sp.set(key, value);
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

// All three dropdowns' options come from MistakeStat, not Decision —
// MistakeStat already has classification/category/errorSeverity as columns
// with only ~173 rows total, so a plain findMany + in-memory dedupe needs
// no index and is fast regardless, unlike a distinct query against the
// much larger Decision table (which needed a dedicated index just for
// this). One shared query, one shared Suspense boundary, decoupled
// entirely from the decision-list query below — the list itself still
// queries Decision directly, since that's where the actual rows live.
async function getFilterOptions() {
  const rows = await prisma.mistakeStat.findMany({
    select: { classification: true, category: true, errorSeverity: true },
  });

  return {
    classifications: [...new Set(rows.map((r) => r.classification))].sort(),
    categories: [...new Set(rows.map((r) => r.category))].sort(),
    severities: [...new Set(rows.map((r) => r.errorSeverity))].sort(),
  };
}

function FilterSelect({
  name,
  current,
  options,
}: {
  name: string;
  current: string | undefined;
  options: string[];
}) {
  return (
    <select
      name={name}
      defaultValue={current ?? ""}
      className="rounded-lg border border-black/10 bg-white px-2 py-1.5 text-sm text-black dark:border-white/15 dark:bg-zinc-800 dark:text-zinc-100"
    >
      <option value="">All</option>
      {options.map((value) => (
        <option key={value} value={value.toLowerCase()}>
          {value.toLowerCase()}
        </option>
      ))}
    </select>
  );
}

async function FilterSelects({
  classification,
  categoryParam,
  severityParam,
}: {
  classification: string | undefined;
  categoryParam: string | undefined;
  severityParam: string | undefined;
}) {
  const { classifications, categories, severities } = await getFilterOptions();

  return (
    <>
      <label className="flex flex-col gap-1 text-xs text-zinc-500 dark:text-zinc-400">
        Classification
        <FilterSelect name="classification" current={classification} options={classifications} />
      </label>
      <label className="flex flex-col gap-1 text-xs text-zinc-500 dark:text-zinc-400">
        Category
        <FilterSelect name="category" current={categoryParam} options={categories} />
      </label>
      <label className="flex flex-col gap-1 text-xs text-zinc-500 dark:text-zinc-400">
        Severity
        <FilterSelect name="severity" current={severityParam} options={severities} />
      </label>
    </>
  );
}

function FilterSelectsFallback() {
  return (
    <>
      {["Classification", "Category", "Severity"].map((label) => (
        <label key={label} className="flex flex-col gap-1 text-xs text-zinc-500 dark:text-zinc-400">
          {label}
          <select
            disabled
            className="rounded-lg border border-black/10 bg-white px-2 py-1.5 text-sm text-zinc-400 dark:border-white/15 dark:bg-zinc-800 dark:text-zinc-500"
          >
            <option>Loading…</option>
          </select>
        </label>
      ))}
    </>
  );
}

interface Filters {
  classification: string | undefined;
  categoryParam: string | undefined;
  severityParam: string | undefined;
  pageSize: number;
  page: number;
}

// The slow part: count + the 50-(or fewer-)row fetch (each with its full
// raw JSON) + pagination. Its own Suspense boundary in the parent, so this
// is the only part a person actually waits on, and only once they've
// applied a filter — never on first load. Rendering itself (list + single
// selected board) is DecisionListWithDetail's job — only one board/SVG
// ever renders at a time there, not once per row.
async function DecisionListSection({ filters }: { filters: Filters }) {
  const { classification, categoryParam, severityParam, pageSize, page } = filters;
  const category = categoryParam ? CATEGORY_PARAM_MAP[categoryParam] : undefined;
  const errorSeverity = severityParam ? SEVERITY_PARAM_MAP[severityParam] : undefined;

  // countAsDecision: true matches the ask exactly; rawError not null is
  // required too — a null rawError is an ungraded/partial analysis (see
  // docs/field-mapping.md), and decisionFromRow can't build a board card
  // from one (no absError to show), same exclusion lib/mistakes.ts's own
  // extractDecisions already applies.
  const where = {
    countAsDecision: true,
    rawError: { not: null },
    ...(classification ? { classification } : {}),
    ...(category ? { kind: category } : {}),
    ...(errorSeverity ? { errorSeverity } : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.decision.count({ where }),
    prisma.decision.findMany({
      where,
      orderBy: { eventId: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        gameId: true,
        eventId: true,
        userId: true,
        color: true,
        kind: true,
        rawError: true,
        errorSeverity: true,
        classification: true,
        raw: true,
        game: { select: { gameIndex: true, match: { select: { sourceMatchId: true } } } },
      },
    }),
  ]);

  // A checker decision's own move_commited event never carries its roll —
  // the preceding dice_rolled event does, stored as its own sibling
  // Decision row (kind: CUBE, often countAsDecision: false) in the same
  // game. The page's main query above only selects countAsDecision: true
  // rows, so it never sees those siblings; fetch every row for just the
  // games actually on this page (cheap — a handful of games, not the whole
  // table) and build a "gameId:eventId" -> roll lookup from them.
  const gameIds = [...new Set(rows.map((row) => row.gameId))];
  const gameRows =
    gameIds.length > 0
      ? await prisma.decision.findMany({
          where: { gameId: { in: gameIds } },
          select: { gameId: true, eventId: true, raw: true },
        })
      : [];
  const rollLookup = buildRollLookup(gameRows);

  const items = rows
    .map((row) => {
      const decision = decisionFromRow(row, rollLookup);
      if (!decision) return null;
      return {
        decision,
        classification: row.classification,
        matchHref: `/matches/${row.game.match.sourceMatchId}`,
      };
    })
    .filter((c) => c !== null);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const baseParams = {
    classification,
    category: categoryParam,
    severity: severityParam,
    pageSize: String(pageSize),
  };
  const filterDescription =
    [classification, categoryParam, severityParam].filter(Boolean).join(" ") || "all";

  return (
    <>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        {total.toLocaleString()} {filterDescription} decision{total === 1 ? "" : "s"}.
      </p>

      <DecisionListWithDetail items={items} />

      <div className="flex items-center justify-between">
        <Link
          href={
            page > 1 ? `/mistakes${buildQueryString({ ...baseParams, page: String(page - 1) })}` : "#"
          }
          className={`inline-flex h-9 items-center justify-center rounded-full border border-black/10 px-4 text-sm font-medium text-black dark:border-white/15 dark:text-zinc-100 ${
            page <= 1 ? "pointer-events-none opacity-40" : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
          }`}
        >
          Prev
        </Link>
        <span className="text-sm text-zinc-600 dark:text-zinc-400">
          Page {page} of {totalPages}
        </span>
        <Link
          href={
            page < totalPages
              ? `/mistakes${buildQueryString({ ...baseParams, page: String(page + 1) })}`
              : "#"
          }
          className={`inline-flex h-9 items-center justify-center rounded-full border border-black/10 px-4 text-sm font-medium text-black dark:border-white/15 dark:text-zinc-100 ${
            page >= totalPages
              ? "pointer-events-none opacity-40"
              : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
          }`}
        >
          Next
        </Link>
      </div>
    </>
  );
}

function DecisionListFallback() {
  return (
    <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
      <span className="h-3 w-3 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600 dark:border-zinc-600 dark:border-t-zinc-300" />
      Loading decisions…
    </div>
  );
}

export default async function MistakesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const classification = typeof sp.classification === "string" ? sp.classification : undefined;
  const categoryParam = typeof sp.category === "string" ? sp.category.toLowerCase() : undefined;
  const severityParam = typeof sp.severity === "string" ? sp.severity.toLowerCase() : undefined;
  const pageParam = typeof sp.page === "string" ? Number(sp.page) : 1;
  const page = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1;
  const pageSizeParam = typeof sp.pageSize === "string" ? Number(sp.pageSize) : DEFAULT_PAGE_SIZE;
  const pageSize = (PAGE_SIZE_OPTIONS as readonly number[]).includes(pageSizeParam)
    ? pageSizeParam
    : DEFAULT_PAGE_SIZE;

  const hasFilter = Boolean(classification || categoryParam || severityParam);

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 dark:bg-black">
      <main className="flex w-full max-w-7xl flex-col gap-6 px-6 py-12">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
            Mistakes
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Browse individual decisions matching a filter.{" "}
            <Link
              href="/matches/analysis"
              className="underline hover:text-black dark:hover:text-zinc-100"
            >
              ← back to analysis
            </Link>
          </p>
        </div>

        <form
          method="get"
          className="flex flex-wrap items-end gap-3 rounded-lg border border-black/10 bg-white p-3 dark:border-white/15 dark:bg-zinc-900"
        >
          <Suspense fallback={<FilterSelectsFallback />}>
            <FilterSelects
              classification={classification}
              categoryParam={categoryParam}
              severityParam={severityParam}
            />
          </Suspense>
          <label className="flex flex-col gap-1 text-xs text-zinc-500 dark:text-zinc-400">
            Per page
            <select
              name="pageSize"
              defaultValue={String(pageSize)}
              className="rounded-lg border border-black/10 bg-white px-2 py-1.5 text-sm text-black dark:border-white/15 dark:bg-zinc-800 dark:text-zinc-100"
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="rounded-full border border-black/10 px-4 py-1.5 text-sm font-medium text-black hover:bg-zinc-100 dark:border-white/15 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            Apply
          </button>
        </form>

        {hasFilter ? (
          <Suspense fallback={<DecisionListFallback />}>
            <DecisionListSection
              filters={{ classification, categoryParam, severityParam, pageSize, page }}
            />
          </Suspense>
        ) : (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Select a filter above to see matching decisions.
          </p>
        )}
      </main>
    </div>
  );
}
