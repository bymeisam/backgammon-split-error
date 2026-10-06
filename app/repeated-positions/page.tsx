import { Suspense } from "react";
import Link from "next/link";
import { prismaReadOnly as prisma } from "@/lib/prisma";
import { isGalaxyEnabled } from "@/lib/galaxyGate";
import { findPositionOccurrences, loadDecisionItems } from "@/lib/decisionQueries";
import {
  PAGE_SIZE_OPTIONS,
  buildQueryString,
  describeFilters,
  lowercaseOptions,
  parseListParams,
  positiveIntParam,
  severityFromParam,
  totalPagesFor,
  type SearchParams,
} from "@/lib/listParams";
import DecisionListWithDetail from "@/app/components/match-analysis/DecisionListWithDetail";
import SeverityBadge from "@/app/components/ui/SeverityBadge";
import ClassificationBadge from "@/app/components/ui/ClassificationBadge";
import { FilterSelect, FilterSelectFallback } from "@/app/components/ui/FilterSelect";
import PaginationLinks from "@/app/components/ui/PaginationLinks";
import { severityKey } from "@/lib/badges";
import { getClassificationLabel, phaseOptionsFor, resolvePhaseWhere } from "@/lib/classificationLabels";
import { style } from "./repeatedPositions.styles";

// Server component, queried fresh on every request — same pattern
// /mistakes and /matches/analysis already use. prismaReadOnly throughout:
// pure read feature, no writes.
export const dynamic = "force-dynamic";

const DEFAULT_PAGE_SIZE = 20;

// RepeatedPosition is small (a few thousand rows, only ever positions
// actually repeated more than once — see lib/recompute-repeated-positions.ts)
// — a plain findMany + in-memory dedupe needs no index, same reasoning
// /mistakes's own MistakeStat-sourced dropdowns use.
async function getFilterOptions() {
  const rows = await prisma.repeatedPosition.findMany({
    select: { classification: true, errorSeverity: true },
  });

  return {
    classifications: [...new Set(rows.map((r) => r.classification))].sort(),
    severities: [...new Set(rows.map((r) => r.errorSeverity))].sort(),
  };
}

async function FilterSelects({
  phase,
  severityParam,
}: {
  phase: string | undefined;
  severityParam: string | undefined;
}) {
  const { classifications, severities } = await getFilterOptions();

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
  severityParam: string | undefined;
  pageSize: number;
  page: number;
}

async function PositionListSection({ filters }: { filters: Filters }) {
  const { phase, severityParam, pageSize, page } = filters;
  const errorSeverity = severityFromParam(severityParam);

  const where = {
    ...(phase ? resolvePhaseWhere(phase) : {}),
    ...(errorSeverity ? { errorSeverity } : {}),
  };

  const [total, positions] = await Promise.all([
    prisma.repeatedPosition.count({ where }),
    prisma.repeatedPosition.findMany({
      where,
      orderBy: { occurrenceCount: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const baseParams = {
    phase,
    severity: severityParam,
    pageSize: String(pageSize),
  };

  return (
    <>
      <p className={style.mutedText}>
        {total.toLocaleString()} {describeFilters(phase, severityParam)} repeated position
        {total === 1 ? "" : "s"}.
      </p>

      {positions.length === 0 ? (
        <p className={style.mutedText}>No repeated positions match this filter.</p>
      ) : (
        <div className={style.positionTable}>
          <table className={style.positionTableInner}>
            <thead>
              <tr className={style.positionTableHead}>
                <th className={style.positionTableHeadCell}>Classification</th>
                <th className={style.positionTableHeadCell}>Severity</th>
                <th className={style.positionTableHeadCell}>Position ID</th>
                <th className={style.positionTableHeadCell}>Times faced</th>
                <th className={style.positionTableHeadCell}></th>
              </tr>
            </thead>
            <tbody>
              {positions.map((p) => (
                <tr key={p.id} className={style.positionRow}>
                  <td className={style.positionBadgeCell}>
                    <ClassificationBadge type={p.classification} />
                  </td>
                  <td className={style.positionBadgeCell}>
                    <SeverityBadge type={severityKey(p.errorSeverity)} />
                  </td>
                  <td className={style.positionCell}>
                    <span className={style.positionIdText}>{p.sourcePositionId}</span>
                  </td>
                  <td className={style.positionCell}>
                    <span className={style.occurrenceCount}>{p.occurrenceCount}×</span>
                  </td>
                  <td className={style.positionCell}>
                    <Link
                      href={`/repeated-positions${buildQueryString({ ...baseParams, positionId: String(p.id) })}`}
                      className={style.viewLink}
                    >
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <PaginationLinks
        basePath="/repeated-positions"
        params={baseParams}
        page={page}
        totalPages={totalPagesFor(total, pageSize)}
      />
    </>
  );
}

function PositionListFallback() {
  return (
    <div className={style.fallbackRow}>
      <span className={style.fallbackSpinner} />
      Loading positions…
    </div>
  );
}

// One selected position's individual Decision occurrences — same
// list+detail board view app/mistakes/page.tsx's DecisionListSection
// uses (DecisionListWithDetail), just scoped to one
// exact position instead of a classification/severity filter (the query
// itself, and why it's shaped the way it is, is
// lib/decisionQueries.ts's findPositionOccurrences). Operates on one already-resolved
// RepeatedPosition row (by numeric positionId), never on the Phase dropdown
// value directly, so it needs no filter-resolution logic of its own.
async function PositionDetailSection({
  positionId,
  baseParams,
}: {
  positionId: number;
  baseParams: Record<string, string | undefined>;
}) {
  const position = await prisma.repeatedPosition.findUnique({ where: { id: positionId } });

  if (!position) {
    return (
      <p className={style.mutedText}>
        That repeated position no longer exists (it may have dropped below the &gt;1 threshold on
        a later recompute).
      </p>
    );
  }

  const items = await loadDecisionItems(await findPositionOccurrences(position));

  return (
    <>
      <div>
        <Link href={`/repeated-positions${buildQueryString(baseParams)}`} className={style.backLink}>
          ← back to repeated positions
        </Link>
      </div>
      <p className={style.mutedText}>
        {items.length} occurrence{items.length === 1 ? "" : "s"} of this position (
        {getClassificationLabel(position.classification)}, {position.errorSeverity.toLowerCase()}
        {position.plyNumber ? `, ply ${position.plyNumber}` : ""}).
      </p>
      <DecisionListWithDetail items={items} showClassification={false} canEditNotes={isGalaxyEnabled()} />
    </>
  );
}

export default async function RepeatedPositionsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  // ?phase= / ?classification= alias, page and pageSize: see parseListParams.
  const { phase, severityParam, page, pageSize } = parseListParams(sp, {
    defaultPageSize: DEFAULT_PAGE_SIZE,
  });
  const positionId = positiveIntParam(sp, "positionId");

  const baseParams = {
    phase,
    severity: severityParam,
    pageSize: String(pageSize),
  };
  // Same gate /mistakes uses: no query against the (small but real) list
  // runs until a filter is actually applied — a positionId deep link is
  // its own explicit, already-scoped action and bypasses this regardless.
  const hasFilter = Boolean(phase || severityParam);

  return (
    <div className={style.pageContainer}>
      <main className={style.main}>
        <div>
          <h1 className={style.title}>Repeated positions</h1>
          <p className={style.subtitle}>
            Positions you&apos;ve faced more than once, and how you did each time.{" "}
            <Link href="/matches/analysis" className={style.backLink}>
              ← back to analysis
            </Link>
          </p>
        </div>

        <form method="get" className={style.form}>
          <Suspense fallback={<FilterSelectFallback labels={["Phase", "Severity"]} />}>
            <FilterSelects phase={phase} severityParam={severityParam} />
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

        {positionId ? (
          <Suspense fallback={<PositionListFallback />}>
            <PositionDetailSection positionId={positionId} baseParams={baseParams} />
          </Suspense>
        ) : hasFilter ? (
          <Suspense fallback={<PositionListFallback />}>
            <PositionListSection filters={{ phase, severityParam, pageSize, page }} />
          </Suspense>
        ) : (
          <p className={style.noFilterText}>Select a filter above to see repeated positions.</p>
        )}
      </main>
    </div>
  );
}
