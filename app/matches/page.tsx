"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AnalysesListResponse } from "@/lib/analysesTypes";
import { formatMatchDate } from "@/lib/formatDate";
import { jsonOrThrow } from "@/lib/galaxyPost";
import Pager from "@/app/components/ui/Pager";
import { style } from "./matches.styles";

export default function MatchesPage() {
  const router = useRouter();

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

  return (
    <div className={style.pageContainer}>
      <main className={style.main}>
        <div className={style.headerRow}>
          <h1 className={style.title}>
            Matches
          </h1>
          <Link href="/matches/analysis" className={style.analysisLink}>
            Mistake pattern analysis →
          </Link>
        </div>

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
                  <tr className={style.tableHeadRow}>
                    <th className={style.tableHeadCell}>Match ID</th>
                    <th className={style.tableHeadCell}>Date</th>
                    <th className={style.tableHeadCell}>Opponent</th>
                    <th className={style.tableHeadCell}>Rating</th>
                    <th className={style.tableHeadCell}>Score</th>
                    <th className={style.tableHeadCell}>Your error</th>
                    <th className={style.tableHeadCell}>Opponent error</th>
                    <th className={style.tableHeadCell}></th>
                  </tr>
                </thead>
                <tbody>
                  {data.analyses.map((m) => (
                    <tr
                      key={m.matchId}
                      onClick={() => router.push(`/matches/${m.matchId}`)}
                      className={style.tableRow}
                    >
                      <td className={style.tableCell}>
                        {m.matchId}
                      </td>
                      <td className={style.tableCell}>
                        {m.playedAt ? formatMatchDate(m.playedAt) : "—"}
                      </td>
                      <td className={style.opponentCell}>{m.opponentName}</td>
                      <td className={style.tableCell}>
                        {m.opponentRating}
                      </td>
                      <td className={style.tableCell}>
                        {m.userScore}–{m.opponentScore}
                      </td>
                      <td className={style.tableCell}>
                        {m.userError.toFixed(3)}
                      </td>
                      <td className={style.tableCell}>
                        {m.opponentError.toFixed(3)}
                      </td>
                      <td className={style.replayCell}>
                        <Link
                          href={`/matches/${m.matchId}/replay/1`}
                          onClick={(e) => e.stopPropagation()}
                          className={style.replayLink}
                        >
                          Replay
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pager page={page} shownPage={data.page} totalPages={data.totalPages} setPage={setPage} />
          </>
        )}
      </main>
    </div>
  );
}
