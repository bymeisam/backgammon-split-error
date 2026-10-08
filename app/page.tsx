import { Suspense, cache, type ReactNode } from "react";
import Link from "next/link";
import { ErrorSeverity } from "@/lib/generated/prisma/enums";
import { isGalaxyEnabled } from "@/lib/galaxyGate";
import { listMatches } from "@/lib/local-client";
import { countDueCards } from "@/lib/review/dueCount";
import { dueSplit } from "@/lib/review/queuePlan";
import { weeklyMistakes } from "@/lib/dashboardQueries";
import { listRepeatedPositions } from "@/lib/repeatedPositionQueries";
import { formatShortMatchDate } from "@/lib/formatDate";
import type { MistakeTally } from "@/lib/dashboardStats";
import PageShell from "@/app/components/ui/PageShell";
import Button from "@/app/components/ui/Button";
import ClassificationBadge from "@/app/components/ui/ClassificationBadge";
import { SOURCE_PR_HINT } from "@/lib/sourcePr";
import TodayOverline from "./TodayOverline";
import { style } from "./home.styles";

// Rendered per request: the widgets read the running server's env and DB,
// not the build's.
export const dynamic = "force-dynamic";

const LATEST_MATCH_COUNT = 5;
const REPEATED_BLUNDER_COUNT = 4;

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
// never queries the review tables. The number is the /review header's own
// "N new · N review" for an unfiltered session, summed (today's daily
// limits applied; lib/review/queuePlan.ts), so it's what a session will
// serve and matches the navbar badge. Cards due but held back by today's
// limits (countDueCards, before the limits, minus that) get a faint line.
async function DueCardsWidget() {
  const title = "Due today";
  let due: number;
  let split: { new: number; review: number };
  try {
    const now = new Date();
    [due, split] = await Promise.all([countDueCards(now), dueSplit(now)]);
  } catch (error) {
    return <WidgetError title={title} error={error} />;
  }
  const shown = split.new + split.review;
  const held = due - shown;
  return (
    <Widget title={title}>
      <p className={style.bigNumber} data-testid="dashboard-due">
        {shown.toLocaleString()}
        <small className={style.bigNumberUnit}>{shown === 1 ? "card" : "cards"}</small>
      </p>
      <p className={style.dueSplit} data-testid="dashboard-due-split">
        <span>
          <b className={style.dueSplitCount}>{split.new.toLocaleString()}</b> new
        </span>
        <span>
          <b className={style.dueSplitCount}>{split.review.toLocaleString()}</b> review
        </span>
      </p>
      {held > 0 && (
        <p className={style.dueHeld} data-testid="dashboard-due-held">
          {held.toLocaleString()} more held back by today&apos;s limits
        </p>
      )}
      <div className={style.widgetActions}>
        <Button variant="primary" href="/review">
          {shown > 0 ? "Start review →" : "Open review →"}
        </Button>
        <Link href="/review/cards" className={style.widgetLink}>
          Manage cards
        </Link>
      </div>
    </Widget>
  );
}

// The latest match's Match.userRating (latest = highest Galaxy match id,
// the order /matches uses). The decimals are quieter than the whole part.
async function RatingWidget() {
  const title = "Current rating";
  let latest;
  try {
    latest = (await firstMatchPage()).analyses[0];
  } catch (error) {
    return <WidgetError title={title} error={error} />;
  }
  if (!latest) {
    return (
      <Widget title={title}>
        <p className={style.mutedText}>No matches yet.</p>
      </Widget>
    );
  }
  const [whole, decimals] = latest.userRating.toFixed(2).split(".");
  return (
    <Widget title={title}>
      <p className={style.bigNumber} data-testid="dashboard-rating">
        {Number(whole).toLocaleString()}
        {decimals !== "00" && <span className={style.bigNumberDecimals}>.{decimals}</span>}
      </p>
      <p className={style.widgetNote}>
        After match{" "}
        <Link href={`/matches/${latest.matchId}`} className={style.widgetLink}>
          {latest.matchId}
        </Link>
      </p>
    </Widget>
  );
}

function TallyRow({ label, tally, total }: { label: string; tally: MistakeTally; total?: boolean }) {
  return (
    <tr className={style.miniRow(Boolean(total))}>
      <td className={style.miniLabelCell(Boolean(total))}>{label}</td>
      <td className={style.miniNumberCell}>{tally.errors.toLocaleString()}</td>
      <td className={style.miniNumberCell}>{tally.blunders.toLocaleString()}</td>
    </tr>
  );
}

async function WeeklyMistakesWidget() {
  const title = "Your mistakes · last 7 days";
  let week;
  try {
    week = await weeklyMistakes(new Date());
  } catch (error) {
    return <WidgetError title={title} error={error} />;
  }
  const { errors, blunders } = week.total;
  const all = errors + blunders;
  return (
    <Widget title={title}>
      <table className={style.miniTable} data-testid="dashboard-weekly-mistakes">
        <thead>
          <tr>
            <th className={style.miniHeadCellLeft}>
              <span className={style.srOnly}>Kind</span>
            </th>
            <th className={style.miniHeadCell}>
              <span className={style.miniDot("error")} aria-hidden="true" />
              Errors
            </th>
            <th className={style.miniHeadCell}>
              <span className={style.miniDot("blunder")} aria-hidden="true" />
              Blunders
            </th>
          </tr>
        </thead>
        <tbody>
          <TallyRow label="Checker" tally={week.checker} />
          <TallyRow label="Cube" tally={week.cube} />
          <TallyRow label="Total" tally={week.total} total />
        </tbody>
      </table>
      {/* Each total's share of the week's mistakes. */}
      <div className={style.stackBar} role="img" aria-label={`${errors} errors, ${blunders} blunders`}>
        {all > 0 && (
          <>
            <span className={style.stackBarError} style={{ width: `${(errors / all) * 100}%` }} />
            <span className={style.stackBarBlunder} style={{ width: `${(blunders / all) * 100}%` }} />
          </>
        )}
      </div>
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
  const now = new Date();
  return (
    <div className={style.tableWrapper}>
      <table className={style.table} data-testid="dashboard-latest-matches">
        <thead>
          <tr>
            <th className={style.tableHeadCell}>Date</th>
            <th className={style.tableHeadCell}>Opponent</th>
            <th className={style.tableHeadCellWide}>Score</th>
            <th className={style.tableHeadCellNumeric}>
              <span title={SOURCE_PR_HINT} className={style.prHint}>
                Your PR
              </span>
            </th>
            <th className={style.chevronHeadCell} aria-hidden="true"></th>
          </tr>
        </thead>
        <tbody>
          {matches.map((m) => (
            <tr key={m.matchId} className={style.tableRow}>
              <td className={style.dateCell}>{m.playedAt ? formatShortMatchDate(m.playedAt, now) : "—"}</td>
              <td className={style.opponentCell}>
                {/* The row's one link, stretched over the whole row. */}
                <Link href={`/matches/${m.matchId}`} className={style.matchLink}>
                  {m.opponentName}
                </Link>
              </td>
              <td className={style.scoreCell}>
                {m.userScore}–{m.opponentScore}
              </td>
              <td className={style.prCell}>
                <span className={style.prValue}>
                  {/* The bar: 5px per point of error, capped at 100px. */}
                  <span
                    className={style.prBar}
                    style={{ width: `${Math.min(m.userError * 5, 100)}px` }}
                    aria-hidden="true"
                  />
                  {m.userError.toFixed(2)}
                </span>
              </td>
              <td className={style.chevronCell} aria-hidden="true">
                ›
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// The user's most-faced repeated positions graded Blunder — the
// /repeated-positions list's own query (lib/repeatedPositionQueries.ts),
// filtered to blunders, top 4. Read-only.
async function RepeatedBlundersWidget() {
  let positions;
  try {
    positions = await listRepeatedPositions({ errorSeverity: ErrorSeverity.BLUNDER }, { take: REPEATED_BLUNDER_COUNT });
  } catch (error) {
    return <WidgetError title="Most repeated blunders" error={error} />;
  }
  if (positions.length === 0) return <p className={style.mutedText}>No repeated blunders yet.</p>;
  return (
    <div className={style.repeatCard} data-testid="dashboard-repeated-blunders">
      {positions.map((p) => (
        <Link
          key={p.id}
          href={`/repeated-positions?severity=blunder&positionId=${p.id}`}
          className={style.repeatItem}
        >
          <ClassificationBadge type={p.classification} />
          <span className={style.repeatPosition}>{p.sourcePositionId}</span>
          <span className={style.repeatTimes}>
            {p.occurrenceCount}
            <small className={style.repeatTimesUnit}>×</small>
          </span>
        </Link>
      ))}
    </div>
  );
}

export default function Home() {
  const galaxyEnabled = isGalaxyEnabled();

  return (
    <PageShell
      overline={<TodayOverline />}
      title="Dashboard"
      subtitle="PR and mistake breakdowns for your matches."
    >
      <div className={style.widgetGrid(galaxyEnabled)}>
        {galaxyEnabled && (
          <Suspense fallback={<WidgetFallback title="Due today" />}>
            <DueCardsWidget />
          </Suspense>
        )}
        <Suspense fallback={<WidgetFallback title="Your mistakes · last 7 days" />}>
          <WeeklyMistakesWidget />
        </Suspense>
        <Suspense fallback={<WidgetFallback title="Current rating" />}>
          <RatingWidget />
        </Suspense>
      </div>

      <div className={style.lowerRow}>
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

        <section className={style.section}>
          <div className={style.sectionHeader}>
            <h2 className={style.sectionTitle}>Most repeated blunders</h2>
            <Link href="/repeated-positions?severity=blunder" className={style.widgetLink}>
              All →
            </Link>
          </div>
          <Suspense fallback={<p className={style.mutedText}>Loading…</p>}>
            <RepeatedBlundersWidget />
          </Suspense>
        </section>
      </div>
    </PageShell>
  );
}
