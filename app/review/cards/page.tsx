import Link from "next/link";
import type { Prisma } from "@/lib/generated/prisma/client";
import { prismaReadOnly as prisma } from "@/lib/prisma";
import { isGalaxyEnabled } from "@/lib/galaxyGate";
import {
  categoryLabel,
  categoryOptions,
  filterSummary,
  positiveIntParam,
  stringParam,
  totalPagesFor,
  type SearchParams,
} from "@/lib/listParams";
import { getClassificationLabel, getPhaseLabel, phaseOptionsFor } from "@/lib/classificationLabels";
import { DECISION_LIST_SELECT } from "@/lib/decisionQueries";
import { reviewDecisionWhere, reviewFilterParams, reviewFiltersFrom } from "@/lib/review/filters";
import { startOfNextLocalDay } from "@/lib/review/queue";
import { CARD_STATE, CARD_STATE_LABEL } from "@/lib/review/cardState";
import { formatRelativeDue } from "@/lib/review/format";
import { cardListSummary } from "@/lib/review/cardPayload";
import { FilterSelect } from "@/app/components/ui/FilterSelect";
import PaginationLinks from "@/app/components/ui/PaginationLinks";
import PageShell from "@/app/components/ui/PageShell";
import FilterDisclosure from "@/app/components/ui/FilterDisclosure";
import CardActions from "./CardActions";
import { style } from "./reviewCards.styles";

// /review/cards: every review card, paginated, filterable by tag, phase,
// type and state. Browsable read-only on the live site; suspend /
// unsuspend / delete only with write mode on. Reads with prismaReadOnly.
// ?card=<id> shows just that card (the "In review" link on the boards).
export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

const STATE_OPTIONS = [
  { value: "due", label: "Due" },
  { value: "new", label: "New" },
  { value: "suspended", label: "Suspended" },
];

function stateWhere(state: string | undefined, now: Date): Prisma.ReviewCardWhereInput {
  switch (state) {
    case "due":
      return { suspended: false, due: { lt: startOfNextLocalDay(now) } };
    case "new":
      return { state: CARD_STATE.new };
    case "suspended":
      return { suspended: true };
    default:
      return {};
  }
}

export default async function ReviewCardsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const filters = reviewFiltersFrom((k) => stringParam(sp, k));
  const state = stringParam(sp, "state");
  const cardId = positiveIntParam(sp, "card");
  const page = positiveIntParam(sp, "page") ?? 1;
  const canEdit = isGalaxyEnabled();
  const now = new Date();

  const where: Prisma.ReviewCardWhereInput = cardId
    ? { id: cardId }
    : { ...stateWhere(state, now), decision: reviewDecisionWhere(filters) };

  const [tags, stats, total, cards] = await Promise.all([
    prisma.tag.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.mistakeStat.findMany({ select: { classification: true, category: true } }),
    prisma.reviewCard.count({ where }),
    prisma.reviewCard.findMany({
      where,
      orderBy: [{ due: "asc" }, { id: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        due: true,
        reps: true,
        lapses: true,
        state: true,
        suspended: true,
        decision: { select: DECISION_LIST_SELECT },
      },
    }),
  ]);
  const classifications = [...new Set(stats.map((r) => r.classification))].sort();
  const categories = [...new Set(stats.map((r) => r.category))].sort();

  return (
    <PageShell
      breadcrumbs={[{ label: "Review", href: "/review" }, { label: "Cards" }]}
      title="Review cards"
      subtitle={
        canEdit ? (
          <Link href="/review" className={style.link}>
            ← Review now
          </Link>
        ) : (
          "Read-only: reviewing and editing cards happen in the local app (write mode)."
        )
      }
    >
      <div className={style.filterRow}>
        <FilterDisclosure
          summary={filterSummary([
            [filters.tag ? (tags.find((t) => String(t.id) === filters.tag)?.name ?? "Unknown tag") : undefined, "All tags"],
            [filters.phase ? getPhaseLabel(filters.phase) : undefined, "Any phase"],
            [filters.category ? categoryLabel(filters.category) : undefined, "All types"],
            [STATE_OPTIONS.find((o) => o.value === state)?.label, "Any state"],
          ])}
        >
          <form method="get" className={style.form}>
            <FilterSelect
              label="Tag"
              name="tag"
              defaultValue={filters.tag ?? ""}
              options={tags.map((t) => ({ value: String(t.id), label: t.name }))}
              emptyLabel="Any"
            />
            <FilterSelect
              label="Phase"
              name="phase"
              defaultValue={filters.phase ?? ""}
              options={phaseOptionsFor(classifications)}
              emptyLabel="Any"
            />
            <FilterSelect
              label="Type"
              name="category"
              defaultValue={filters.category ?? ""}
              options={categoryOptions(categories)}
              emptyLabel="All"
            />
            <FilterSelect label="State" name="state" defaultValue={state ?? ""} options={STATE_OPTIONS} emptyLabel="All" />
            <button type="submit" className={style.applyButton}>
              Apply
            </button>
          </form>
        </FilterDisclosure>
      </div>

      <p className={style.mutedText}>
        {total.toLocaleString()} card{total === 1 ? "" : "s"}
        {cardId ? (
          <>
            {" "}
            ·{" "}
            <Link href="/review/cards" className={style.link}>
              show all
            </Link>
          </>
        ) : null}
        .
      </p>

      {cards.length > 0 && (
        <div className={style.tableWrapper}>
          <table data-testid="review-cards-table" className={style.table}>
            <thead>
              <tr>
                <th className={style.headCell}>Position</th>
                <th className={style.headCell}>Type</th>
                <th className={style.headCell}>Phase</th>
                <th className={style.headCell}>Tags</th>
                <th className={style.headCell}>Due</th>
                <th className={style.headCellNumeric}>Reps</th>
                <th className={style.headCellNumeric}>Lapses</th>
                <th className={style.headCell}>State</th>
                {canEdit && <th className={style.headCell}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {cards.map((c) => {
                const summary = cardListSummary(c.decision);
                const m = c.decision.game.match;
                return (
                  <tr key={c.id} data-card-id={c.id} className={style.row(c.suspended)}>
                    <td className={style.cell}>
                      <div className={style.positionText}>{summary.text}</div>
                      <Link
                        href={`/matches/${encodeURIComponent(m.sourceMatchId)}/replay/${c.decision.game.gameIndex}?decision=${c.decision.id}`}
                        className={style.positionLink}
                      >
                        Match {m.sourceMatchId} · game {c.decision.game.gameIndex}
                      </Link>
                    </td>
                    <td className={style.cell}>{summary.type}</td>
                    <td className={style.cell}>{getClassificationLabel(c.decision.classification)}</td>
                    <td className={style.cell}>
                      {c.decision.tags.map((t) => (
                        <span key={t.tag.id} className={style.tagChip}>
                          {t.tag.name}
                        </span>
                      ))}
                    </td>
                    <td className={style.cell} title={c.due.toLocaleString()}>
                      {formatRelativeDue(c.due, now)}
                    </td>
                    <td className={style.numCell}>{c.reps}</td>
                    <td className={style.numCell}>{c.lapses}</td>
                    <td className={style.cell}>
                      <span className={style.stateText}>
                        {c.suspended ? "Suspended" : (CARD_STATE_LABEL[c.state] ?? String(c.state))}
                      </span>
                    </td>
                    {canEdit && (
                      <td className={style.cell}>
                        <CardActions cardId={c.id} suspended={c.suspended} />
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <PaginationLinks
        basePath="/review/cards"
        params={{ ...reviewFilterParams(filters), state, card: cardId ? String(cardId) : undefined }}
        page={page}
        totalPages={totalPagesFor(total, PAGE_SIZE)}
      />
    </PageShell>
  );
}
