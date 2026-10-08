import Link from "next/link";
import { prismaReadOnly as prisma } from "@/lib/prisma";
import { isGalaxyEnabled } from "@/lib/galaxyGate";
import { lowercaseOptions, severityOptions, stringParam, type SearchParams } from "@/lib/listParams";
import { phaseOptionsFor } from "@/lib/classificationLabels";
import { reviewFiltersFrom } from "@/lib/review/filters";
import { FilterSelect } from "@/app/components/ui/FilterSelect";
import PageShell from "@/app/components/ui/PageShell";
import ReviewSession from "./ReviewSession";
import { style } from "./review.styles";

// /review: a spaced-repetition session over the review cards. Writes (each
// answer) need write mode, so with it off (the live read-only site) this
// only says where reviewing happens; /review/cards stays browsable. Filter
// options read with prismaReadOnly; the session itself runs client-side
// against /api/review/* (gated by proxy.ts).
export const dynamic = "force-dynamic";

export default async function ReviewPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  if (!isGalaxyEnabled()) {
    return (
      <PageShell title="Review">
        <p data-testid="review-read-only" className={style.readOnlyBox}>
          Reviewing is available in the local app (write mode).{" "}
          <Link href="/review/cards" className={style.link}>
            Browse the cards
          </Link>
        </p>
      </PageShell>
    );
  }

  const sp = await searchParams;
  const filters = reviewFiltersFrom((k) => stringParam(sp, k));

  // Filter options: tags from Tag, the rest from MistakeStat (as /mistakes).
  const [tags, stats] = await Promise.all([
    prisma.tag.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.mistakeStat.findMany({ select: { classification: true, category: true, errorSeverity: true } }),
  ]);
  const classifications = [...new Set(stats.map((r) => r.classification))].sort();
  const categories = [...new Set(stats.map((r) => r.category))].sort();
  const severities = [...new Set(stats.map((r) => r.errorSeverity))].sort();

  return (
    <PageShell
      title="Review"
      subtitle={
        <>
          Your due cards, one at a time.{" "}
          <Link href="/review/cards" className={style.link}>
            Manage cards
          </Link>
        </>
      }
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
          options={lowercaseOptions(categories)}
          emptyLabel="All"
        />
        <FilterSelect
          label="Severity"
          name="severity"
          defaultValue={filters.severity ?? ""}
          options={severityOptions(severities)}
          emptyLabel="All"
        />
        <button type="submit" className={style.applyButton}>
          Apply
        </button>
      </form>

      {/* Keyed by the filters: a new filter starts a new session. */}
      <ReviewSession key={JSON.stringify(filters)} filters={filters} />
    </PageShell>
  );
}
