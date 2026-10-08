"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { AnalysesListResponse } from "@/lib/analysesTypes";
import { formatShortMatchDate } from "@/lib/formatDate";
import { jsonOrThrow } from "@/lib/galaxyPost";
import Pager from "@/app/components/ui/Pager";
import PageShell from "@/app/components/ui/PageShell";
import { style } from "./matches.styles";

export default function MatchesPage() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AnalysesListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setError(null);

      try {
        const json = await jsonOrThrow(await fetch(`/api/matches/list/${page}`));
        if (!cancelled) setData(json as AnalysesListResponse);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Something went wrong.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [page]);

  const now = new Date();

  return (
    <PageShell
      width="medium"
      title="Matches"
      actions={
        <Link href="/matches/analysis" className={style.analysisLink}>
          Mistake pattern analysis →
        </Link>
      }
    >
      {loading && <p className={style.mutedText}>Loading…</p>}
      {error && (
        <p className={style.errorBox}>
          {error}
        </p>
      )}

      {data && (
        <>
          <div className={style.tableWrapper}>
            <table className={style.table}>
              <thead>
                <tr>
                  <th className={style.tableHeadCell}>Match ID</th>
                  <th className={style.tableHeadCellWide}>Date</th>
                  <th className={style.tableHeadCell}>Opponent</th>
                  <th className={style.tableHeadCellWideNumeric}>Rating</th>
                  <th className={style.tableHeadCellWide}>Score</th>
                  <th className={style.tableHeadCellNumeric}>Your error</th>
                  <th className={style.tableHeadCellWideNumeric}>Opp. error</th>
                  <th className={style.chevronHeadCell} aria-hidden="true"></th>
                </tr>
              </thead>
              <tbody>
                {data.analyses.map((m) => (
                  <tr key={m.matchId} className={style.tableRow}>
                    <td className={style.idCell}>{m.matchId}</td>
                    <td className={style.dateCell}>
                      {m.playedAt ? formatShortMatchDate(m.playedAt, now) : "—"}
                    </td>
                    <td className={style.opponentCell}>
                      {/* The row's one link, stretched over the whole row. */}
                      <Link href={`/matches/${m.matchId}`} className={style.rowLink}>
                        {m.opponentName}
                      </Link>
                    </td>
                    <td className={style.ratingCell}>{m.opponentRating}</td>
                    <td className={style.scoreCell}>
                      {m.userScore}–{m.opponentScore}
                    </td>
                    <td className={style.numberCell}>{m.userError.toFixed(2)}</td>
                    <td className={style.oppNumberCell}>{m.opponentError.toFixed(2)}</td>
                    <td className={style.chevronCell} aria-hidden="true">
                      ›
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pager page={page} shownPage={data.page} totalPages={data.totalPages} setPage={setPage} />
        </>
      )}
    </PageShell>
  );
}
