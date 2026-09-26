import { Suspense } from "react";
import Link from "next/link";
import { prismaReadOnly as prisma } from "@/lib/prisma";
import {
  DecisionKind as PrismaDecisionKind,
  ErrorSeverity as PrismaErrorSeverity,
} from "@/lib/generated/prisma/client";
import { decisionFromRow, buildRollLookup } from "@/lib/decisionFromRow";
import DecisionListWithDetail from "@/app/components/match-analysis/DecisionListWithDetail";
import { style } from "./mistakes.styles";

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
    <select name={name} defaultValue={current ?? ""} className={style.filterSelect}>
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
      <label className={style.filterLabel}>
        Classification
        <FilterSelect name="classification" current={classification} options={classifications} />
      </label>
      <label className={style.filterLabel}>
        Category
        <FilterSelect name="category" current={categoryParam} options={categories} />
      </label>
      <label className={style.filterLabel}>
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
        <label key={label} className={style.filterLabel}>
          {label}
          <select disabled className={style.filterSelectDisabled}>
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
      <p className={style.mutedText}>
        {total.toLocaleString()} {filterDescription} decision{total === 1 ? "" : "s"}.
      </p>

      <DecisionListWithDetail items={items} showClassification={!classification} />

      <div className={style.paginationRow}>
        <Link
          href={
            page > 1 ? `/mistakes${buildQueryString({ ...baseParams, page: String(page - 1) })}` : "#"
          }
          className={style.paginationLink(page <= 1)}
        >
          Prev
        </Link>
        <span className={style.mutedText}>
          Page {page} of {totalPages}
        </span>
        <Link
          href={
            page < totalPages
              ? `/mistakes${buildQueryString({ ...baseParams, page: String(page + 1) })}`
              : "#"
          }
          className={style.paginationLink(page >= totalPages)}
        >
          Next
        </Link>
      </div>
    </>
  );
}

function DecisionListFallback() {
  return (
    <div className={style.fallbackRow}>
      <span className={style.fallbackSpinner} />
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
    <div className={style.pageContainer}>
      <main className={style.main}>
        <div>
          <h1 className={style.title}>Mistakes</h1>
          <p className={style.subtitle}>
            Browse individual decisions matching a filter.{" "}
            <Link href="/matches/analysis" className={style.backLink}>
              ← back to analysis
            </Link>
          </p>
        </div>

        <form method="get" className={style.form}>
          <Suspense fallback={<FilterSelectsFallback />}>
            <FilterSelects
              classification={classification}
              categoryParam={categoryParam}
              severityParam={severityParam}
            />
          </Suspense>
          <label className={style.filterLabel}>
            Per page
            <select name="pageSize" defaultValue={String(pageSize)} className={style.filterSelect}>
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className={style.applyButton}>
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
          <p className={style.noFilterText}>Select a filter above to see matching decisions.</p>
        )}
      </main>
    </div>
  );
}
