"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { AnalysesListResponse } from "@/lib/analysesTypes";

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
        const res = await fetch(`/api/matches/list/${page}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error ?? `Request failed (${res.status}).`);
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
    <div className="flex flex-1 justify-center bg-zinc-50 dark:bg-black">
      <main className="flex w-full max-w-4xl flex-col gap-6 px-6 py-12">
        <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
          Matches
        </h1>

        {loading && <p className="text-sm text-zinc-600 dark:text-zinc-400">Loading…</p>}
        {error && (
          <p className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        )}

        {data && (
          <>
            <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/15">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-black/10 bg-zinc-100 text-xs uppercase tracking-wide text-zinc-500 dark:border-white/15 dark:bg-zinc-900 dark:text-zinc-400">
                    <th className="px-3 py-2">Opponent</th>
                    <th className="px-3 py-2">Rating</th>
                    <th className="px-3 py-2">Score</th>
                    <th className="px-3 py-2">Your error</th>
                    <th className="px-3 py-2">Opponent error</th>
                  </tr>
                </thead>
                <tbody>
                  {data.analyses.map((m) => (
                    <tr
                      key={m.matchId}
                      onClick={() => router.push(`/matches/${m.matchId}`)}
                      className="cursor-pointer border-b border-black/5 last:border-b-0 hover:bg-zinc-50 dark:border-white/10 dark:hover:bg-zinc-800/60"
                    >
                      <td className="px-3 py-2 text-black dark:text-zinc-100">{m.opponentName}</td>
                      <td className="px-3 py-2 font-mono text-xs text-black dark:text-zinc-100">
                        {m.opponentRating}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-black dark:text-zinc-100">
                        {m.userScore}–{m.opponentScore}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-black dark:text-zinc-100">
                        {m.userError.toFixed(3)}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-black dark:text-zinc-100">
                        {m.opponentError.toFixed(3)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="inline-flex h-9 items-center justify-center rounded-full border border-black/10 px-4 text-sm font-medium text-black transition-colors hover:bg-zinc-100 disabled:opacity-40 dark:border-white/15 dark:text-zinc-100 dark:hover:bg-zinc-800"
              >
                Prev
              </button>
              <span className="text-sm text-zinc-600 dark:text-zinc-400">
                Page {data.page} of {data.totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                disabled={page >= data.totalPages}
                className="inline-flex h-9 items-center justify-center rounded-full border border-black/10 px-4 text-sm font-medium text-black transition-colors hover:bg-zinc-100 disabled:opacity-40 dark:border-white/15 dark:text-zinc-100 dark:hover:bg-zinc-800"
              >
                Next
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
