import { Suspense } from "react";
import Link from "next/link";
import { prismaReadOnly as prisma } from "@/lib/prisma";
import { ErrorSeverity as PrismaErrorSeverity } from "@/lib/generated/prisma/client";
import { decisionFromRow, buildRollLookup } from "@/lib/decisionFromRow";
import DecisionListWithDetail from "@/app/components/match-analysis/DecisionListWithDetail";
import SeverityBadge from "@/app/components/ui/SeverityBadge";
import ClassificationBadge from "@/app/components/ui/ClassificationBadge";
import type { severityBadges, classificationBadges } from "@/lib/badges";
import { getClassificationLabel, phaseOptionsFor, resolvePhaseWhere, getPhaseLabel } from "@/lib/classificationLabels";
import { style } from "./repeatedPositions.styles";

// Server component, queried fresh on every request — same pattern
// /mistakes and /matches/analysis already use. prismaReadOnly throughout:
// pure read feature, no writes.
export const dynamic = "force-dynamic";

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;
const DEFAULT_PAGE_SIZE = 20;

const SEVERITY_PARAM_MAP: Record<string, PrismaErrorSeverity> = {
  blunder: PrismaErrorSeverity.BLUNDER,
  error: PrismaErrorSeverity.ERROR,
  doubtful: PrismaErrorSeverity.DOUBTFUL,
  none: PrismaErrorSeverity.NONE,
};

function buildQueryString(params: Record<string, string | undefined>): string {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) sp.set(key, value);
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

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
  phase,
  severityParam,
}: {
  phase: string | undefined;
  severityParam: string | undefined;
}) {
  const { classifications, severities } = await getFilterOptions();
  const phaseOptions = phaseOptionsFor(classifications);

  return (
    <>
      <label className={style.filterLabel}>
        Phase
        <select name="phase" defaultValue={phase ?? ""} className={style.filterSelect}>
          <option value="">Any</option>
          {phaseOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
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
      {["Phase", "Severity"].map((label) => (
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
  phase: string | undefined;
  severityParam: string | undefined;
  pageSize: number;
  page: number;
}

async function PositionListSection({ filters }: { filters: Filters }) {
  const { phase, severityParam, pageSize, page } = filters;
  const errorSeverity = severityParam ? SEVERITY_PARAM_MAP[severityParam] : undefined;

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

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const baseParams = {
    phase,
    severity: severityParam,
    pageSize: String(pageSize),
  };
  const filterDescription =
    [phase ? getPhaseLabel(phase) : undefined, severityParam].filter(Boolean).join(" ") || "all";

  return (
    <>
      <p className={style.mutedText}>
        {total.toLocaleString()} {filterDescription} repeated position{total === 1 ? "" : "s"}.
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
                    <ClassificationBadge type={p.classification as keyof typeof classificationBadges} />
                  </td>
                  <td className={style.positionBadgeCell}>
                    <SeverityBadge
                      type={p.errorSeverity.toLowerCase() as keyof typeof severityBadges}
                    />
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

      <div className={style.paginationRow}>
        <Link
          href={
            page > 1
              ? `/repeated-positions${buildQueryString({ ...baseParams, page: String(page - 1) })}`
              : "#"
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
              ? `/repeated-positions${buildQueryString({ ...baseParams, page: String(page + 1) })}`
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
// uses (DecisionListWithDetail, reused unmodified), just scoped to one
// exact position instead of a classification/severity filter. Narrows by
// the same indexed columns the recompute function's own query uses
// (kind/countAsDecision/rawError/errorSeverity) before the unindexed JSON
// match, same reasoning as lib/recompute-repeated-positions.ts: cheap once
// narrowed, not a full-table scan. Operates on one already-resolved
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

  // FORCE INDEX: measured MySQL's optimizer picking
  // Decision_kind_classification_idx here instead (kind-only, ~513k rows
  // to then filter/JSON-extract one by one) over the composite index that
  // also covers countAsDecision/rawError/errorSeverity — 11.4s vs. 1.2s
  // for the exact same query, forced. The composite index's name is a
  // fixed literal from the schema/migration, not user input, so it's safe
  // to inline directly rather than bind as a parameter (FORCE INDEX takes
  // an identifier, not a value, and can't be parameterized anyway).
  const matchingIds = await prisma.$queryRaw<{ id: number }[]>`
    SELECT id FROM Decision
    FORCE INDEX (Decision_countAsDecision_rawError_kind_classification_errorS_idx)
    WHERE kind = 'CHECKER' AND countAsDecision = 1 AND rawError IS NOT NULL
      AND errorSeverity = ${position.errorSeverity}
      AND JSON_UNQUOTE(JSON_EXTRACT(raw, '$.reviews[0].source_position.formatted_value')) = ${position.sourcePositionId}
  `;

  const rows = await prisma.decision.findMany({
    where: { id: { in: matchingIds.map((r) => r.id) } },
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
  });

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
      <DecisionListWithDetail items={items} showClassification={false} />
    </>
  );
}

export default async function RepeatedPositionsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  // ?phase= is the current param; ?classification= is accepted as an alias
  // for it (only when phase itself isn't present) so old drill-down links
  // (?classification=<value>&severity=<severity>) keep working unchanged —
  // see app/mistakes/page.tsx's identical comment for the full reasoning.
  const phase =
    typeof sp.phase === "string"
      ? sp.phase
      : typeof sp.classification === "string"
        ? sp.classification
        : undefined;
  const severityParam = typeof sp.severity === "string" ? sp.severity.toLowerCase() : undefined;
  const pageParam = typeof sp.page === "string" ? Number(sp.page) : 1;
  const page = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1;
  const pageSizeParam = typeof sp.pageSize === "string" ? Number(sp.pageSize) : DEFAULT_PAGE_SIZE;
  const pageSize = (PAGE_SIZE_OPTIONS as readonly number[]).includes(pageSizeParam)
    ? pageSizeParam
    : DEFAULT_PAGE_SIZE;
  const positionIdParam = typeof sp.positionId === "string" ? Number(sp.positionId) : undefined;
  const positionId =
    positionIdParam !== undefined && Number.isInteger(positionIdParam) && positionIdParam > 0
      ? positionIdParam
      : undefined;

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
          <Suspense fallback={<FilterSelectsFallback />}>
            <FilterSelects phase={phase} severityParam={severityParam} />
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
