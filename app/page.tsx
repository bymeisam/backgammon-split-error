import { Suspense, cache, type ReactNode } from "react";
import Link from "next/link";
import { isGalaxyEnabled } from "@/lib/galaxyGate";
import { listMatches } from "@/lib/local-client";
import { countDueCards } from "@/lib/review/dueCount";
import { weeklyMistakes } from "@/lib/dashboardQueries";
import { formatMatchDate } from "@/lib/formatDate";
import type { MistakeTally } from "@/lib/dashboardStats";
import PageShell from "@/app/components/ui/PageShell";
import { style } from "./home.styles";

// Rendered per request: the widgets read the running server's env and DB,
// not the build's.
export const dynamic = "force-dynamic";

const LATEST_MATCH_COUNT = 5;

// The /matches list's own first page (lib/local-client.ts, newest Galaxy
// match id first), shared by the rating and latest-matches widgets: one
// query per request, not two.
const firstMatchPage = cache(() => listMatches(1));

function Widget({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={style.widget}>
      <h2 className={style.widgetTitle}>{title}</h2>
      {children}
    </section>
  );
}

function WidgetFallback({ title }: { title: string }) {
  return (
    <Widget title={title}>
      <p className={style.mutedText}>Loading…</p>
    </Widget>
  );
}

function WidgetError({ title, error }: { title: string; error: unknown }) {
  console.error(`[dashboard] ${title} failed:`, error);
  return (
    <Widget title={title}>
      <p className={style.errorText}>Couldn&apos;t load this.</p>
    </Widget>
  );
}

// Write mode only (Home doesn't render it otherwise): the read-only site
// never queries the review tables.
async function DueCardsWidget() {
  const title = "Cards due today";
  let due: number;
  try {
    due = await countDueCards(new Date());
  } catch (error) {
    return <WidgetError title={title} error={error} />;
  }
  return (
    <Widget title={title}>
      <p className={style.bigNumber} data-testid="dashboard-due">
        {due.toLocaleString()}
      </p>
      <Link href="/review" className={style.reviewButton}>
        {due > 0 ? "Review now →" : "Open review →"}
      </Link>
    </Widget>
  );
}

// The latest match's Match.userRating (latest = highest Galaxy match id,
// the order /matches uses).
async function RatingWidget() {
  const title = "Current rating";
  let latest;
  try {
    latest = (await firstMatchPage()).analyses[0];
  } catch (error) {
    return <WidgetError title={title} error={error} />;
  }
  return (
    <Widget title={title}>
      {latest ? (
        <>
          <p className={style.bigNumber} data-testid="dashboard-rating">
            {latest.userRating.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </p>
          <p className={style.widgetNote}>After match {latest.matchId}</p>
        </>
      ) : (
        <p className={style.mutedText}>No matches yet.</p>
      )}
    </Widget>
  );
}

function TallyRow({ label, tally, total }: { label: string; tally: MistakeTally; total?: boolean }) {
  return (
    <tr className={total ? style.miniTotalRow : undefined}>
      <td className={style.miniLabelCell}>{label}</td>
      <td className={style.miniNumberCell}>{tally.errors.toLocaleString()}</td>
      <td className={style.miniNumberCell}>{tally.blunders.toLocaleString()}</td>
    </tr>
  );
}

async function WeeklyMistakesWidget() {
  const title = "Your mistakes, last 7 days";
  let week;
  try {
    week = await weeklyMistakes(new Date());
  } catch (error) {
    return <WidgetError title={title} error={error} />;
  }
  return (
    <Widget title={title}>
      <table className={style.miniTable} data-testid="dashboard-weekly-mistakes">
        <thead>
          <tr>
            <th className={style.miniHeadCellLeft}></th>
            <th className={style.miniHeadCell}>Errors</th>
            <th className={style.miniHeadCell}>Blunders</th>
          </tr>
        </thead>
        <tbody>
          <TallyRow label="Checker" tally={week.checker} />
          <TallyRow label="Cube" tally={week.cube} />
          <TallyRow label="Total" tally={week.total} total />
        </tbody>
      </table>
      <p className={style.widgetNote}>Counted decisions in matches played since this time last week.</p>
    </Widget>
  );
}

async function LatestMatchesWidget() {
  let matches;
  try {
    matches = (await firstMatchPage()).analyses.slice(0, LATEST_MATCH_COUNT);
  } catch (error) {
    return <WidgetError title="Latest matches" error={error} />;
  }
  if (matches.length === 0) return <p className={style.mutedText}>No matches yet.</p>;
  return (
    <div className={style.tableWrapper}>
      <table className={style.table} data-testid="dashboard-latest-matches">
        <thead>
          <tr className={style.tableHeadRow}>
            <th className={style.tableHeadCell}>Date</th>
            <th className={style.tableHeadCell}>Opponent</th>
            <th className={style.tableHeadCell}>Score</th>
            <th className={style.tableHeadCell}>Your error</th>
          </tr>
        </thead>
        <tbody>
          {matches.map((m) => (
            <tr key={m.matchId} className={style.tableRow}>
              <td className={style.tableCell}>{m.playedAt ? formatMatchDate(m.playedAt) : "—"}</td>
              <td className={style.opponentCell}>
                <Link href={`/matches/${m.matchId}`} className={style.matchLink}>
                  {m.opponentName}
                </Link>
              </td>
              <td className={style.tableCell}>
                {m.userScore}–{m.opponentScore}
              </td>
              <td className={style.tableCell}>{m.userError.toFixed(3)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Home() {
  const galaxyEnabled = isGalaxyEnabled();

  return (
    <PageShell
      width="medium"
      title="Dashboard"
      subtitle="PR and mistake breakdowns for your Backgammon Galaxy matches."
    >
      <div className={style.widgetGrid}>
        {galaxyEnabled && (
          <Suspense fallback={<WidgetFallback title="Cards due today" />}>
            <DueCardsWidget />
          </Suspense>
        )}
        <Suspense fallback={<WidgetFallback title="Your mistakes, last 7 days" />}>
          <WeeklyMistakesWidget />
        </Suspense>
        <Suspense fallback={<WidgetFallback title="Current rating" />}>
          <RatingWidget />
        </Suspense>
      </div>

      <section className={style.section}>
        <div className={style.sectionHeader}>
          <h2 className={style.sectionTitle}>Latest matches</h2>
          <Link href="/matches" className={style.widgetLink}>
            All matches →
          </Link>
        </div>
        <Suspense fallback={<p className={style.mutedText}>Loading…</p>}>
          <LatestMatchesWidget />
        </Suspense>
      </section>
    </PageShell>
  );
}
