import { Suspense } from "react";
import Link from "next/link";
import { prismaReadOnly as prisma } from "@/lib/prisma";
import { DECISION_LIST_SELECT, loadDecisionItems } from "@/lib/decisionQueries";
import {
  PAGE_SIZE_OPTIONS,
  categoryFromParam,
  describeFilters,
  lowercaseOptions,
  lowercaseParam,
  parseListParams,
  severityFromParam,
  totalPagesFor,
  type SearchParams,
} from "@/lib/listParams";
import DecisionListWithDetail from "@/app/components/match-analysis/DecisionListWithDetail";
import { FilterSelect, FilterSelectFallback } from "@/app/components/ui/FilterSelect";
import PaginationLinks from "@/app/components/ui/PaginationLinks";
import { phaseOptionsFor, resolvePhaseWhere } from "@/lib/classificationLabels";
import { style } from "./mistakes.styles";

// Server component, queried fresh on every request (no caching) — same
// pattern /status and /matches/analysis already use. prismaReadOnly
// throughout: pure read feature, no writes.
export const dynamic = "force-dynamic";

const DEFAULT_PAGE_SIZE = 10;

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

async function FilterSelects({
  phase,
  categoryParam,
  severityParam,
}: {
  phase: string | undefined;
  categoryParam: string | undefined;
  severityParam: string | undefined;
}) {
  const { classifications, categories, severities } = await getFilterOptions();

  return (
    <>
      <FilterSelect
        label="Phase"
        name="phase"
        defaultValue={phase ?? ""}
        options={phaseOptionsFor(classifications)}
        emptyLabel="Any"
      />
      <FilterSelect
        label="Category"
        name="category"
        defaultValue={categoryParam ?? ""}
        options={lowercaseOptions(categories)}
        emptyLabel="All"
      />
      <FilterSelect
        label="Severity"
        name="severity"
        defaultValue={severityParam ?? ""}
        options={lowercaseOptions(severities)}
        emptyLabel="All"
      />
    </>
  );
}

interface Filters {
  phase: string | undefined;
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
  const { phase, categoryParam, severityParam, pageSize, page } = filters;
  const category = categoryFromParam(categoryParam);
  const errorSeverity = severityFromParam(severityParam);

  // Only decisions Galaxy counts (countAsDecision: true); rawError not null
  // is required too — a null rawError is an ungraded/partial analysis (see
  // docs/field-mapping.md), and decisionFromRow can't build a board card
  // from one (no absError to show), same exclusion lib/mistakes.ts's own
  // extractDecisions already applies.
  const where = {
    countAsDecision: true,
    rawError: { not: null },
    ...(phase ? resolvePhaseWhere(phase) : {}),
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
      select: DECISION_LIST_SELECT,
    }),
  ]);

  const items = await loadDecisionItems(rows);

  return (
    <>
      <p className={style.mutedText}>
        {total.toLocaleString()} {describeFilters(phase, categoryParam, severityParam)} decision
        {total === 1 ? "" : "s"}.
      </p>

      <DecisionListWithDetail items={items} showClassification={!phase} />

      <PaginationLinks
        basePath="/mistakes"
        params={{ phase, category: categoryParam, severity: severityParam, pageSize: String(pageSize) }}
        page={page}
        totalPages={totalPagesFor(total, pageSize)}
      />
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
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const { phase, severityParam, page, pageSize } = parseListParams(sp, {
    defaultPageSize: DEFAULT_PAGE_SIZE,
  });
  const categoryParam = lowercaseParam(sp, "category");

  const hasFilter = Boolean(phase || categoryParam || severityParam);

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
          <Suspense fallback={<FilterSelectFallback labels={["Phase", "Category", "Severity"]} />}>
            <FilterSelects phase={phase} categoryParam={categoryParam} severityParam={severityParam} />
          </Suspense>
          <FilterSelect
            label="Per page"
            name="pageSize"
            defaultValue={String(pageSize)}
            options={PAGE_SIZE_OPTIONS.map((n) => ({ value: String(n), label: String(n) }))}
          />
          <button type="submit" className={style.applyButton}>
            Apply
          </button>
        </form>

        {hasFilter ? (
          <Suspense fallback={<DecisionListFallback />}>
            <DecisionListSection filters={{ phase, categoryParam, severityParam, pageSize, page }} />
          </Suspense>
        ) : (
          <p className={style.noFilterText}>Select a filter above to see matching decisions.</p>
        )}
      </main>
    </div>
  );
}
