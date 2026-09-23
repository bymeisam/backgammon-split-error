"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useGameStatsAuth } from "@/app/GameStatsProvider";
import type { AnalysesListResponse, MatchAnalysis } from "@/lib/analysesTypes";
import TokenModal from "./TokenModal";

type SyncState =
  | { status: "syncing" }
  | { status: "synced" }
  | { status: "error"; message: string };

export default function MatchesPage() {
  const router = useRouter();
  const { token } = useGameStatsAuth();

  const [page, setPage] = useState(1);
  const [data, setData] = useState<AnalysesListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncStates, setSyncStates] = useState<Record<number, SyncState>>({});
  // sourceMatchIds (as strings, matching the DB column) already fully
  // ingested (ingestStatus: DONE), for the currently-displayed page only —
  // refetched fresh whenever `data` changes, not accumulated across pages.
  const [doneMatchIds, setDoneMatchIds] = useState<Set<string>>(new Set());
  const [jumpToMatchId, setJumpToMatchId] = useState("");
  const [jsonGameIndex, setJsonGameIndex] = useState("1");
  const [jsonDump, setJsonDump] = useState<
    | { status: "loading" }
    | { status: "data"; text: string }
    | { status: "error"; message: string }
    | null
  >(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    async function run() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/galaxy/matches/list/${page}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ authorization: token }),
        });
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
  }, [token, page]);

  // One batched existence check per page load, not N per-match lookups —
  // separate from the list fetch above so a failure here (or the DB simply
  // being briefly unreachable) can't block the match list itself from
  // rendering; worst case every row just falls back to showing "Sync".
  useEffect(() => {
    if (!data || data.analyses.length === 0) {
      setDoneMatchIds(new Set());
      return;
    }

    let cancelled = false;

    async function run() {
      try {
        const matchIds = data!.analyses.map((m) => m.matchId).join(",");
        const res = await fetch(`/api/matches/check-existence?matchIds=${matchIds}`);
        if (!res.ok) throw new Error(`Request failed (${res.status}).`);
        const json = await res.json();
        if (!cancelled) setDoneMatchIds(new Set(json.done as string[]));
      } catch (e) {
        console.error("Failed to check existing matches:", e);
        if (!cancelled) setDoneMatchIds(new Set());
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [data]);

  // Per-match, button-triggered sync. Deliberately structured as a handler
  // over a single matchId (not a loop) — a later "sync all new" button can
  // just call this once per match without any rewrite here.
  async function onSyncMatch(match: MatchAnalysis) {
    if (!token) return;

    setSyncStates((prev) => ({ ...prev, [match.matchId]: { status: "syncing" } }));

    try {
      const res = await fetch(`/api/galaxy/matches/${match.matchId}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authorization: token,
          indexData: {
            opponentName: match.opponentName,
            opponentCountry: match.opponentCountry,
            opponentRating: match.opponentRating,
            opponentError: match.opponentError,
            opponentScore: match.opponentScore,
            userError: match.userError,
            userRating: match.userRating,
            userScore: match.userScore,
          },
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? `Request failed (${res.status}).`);

      // A 200 here just means the sync ran — if it ingested nothing and has
      // errors, that's a real failure (e.g. a bad/expired token), not a
      // success with an empty match.
      if (json.gamesIngested === 0 && json.errors?.length > 0) {
        throw new Error(json.errors[0]);
      }

      setSyncStates((prev) => ({ ...prev, [match.matchId]: { status: "synced" } }));
    } catch (e) {
      setSyncStates((prev) => ({
        ...prev,
        [match.matchId]: {
          status: "error",
          message: e instanceof Error ? e.message : "Sync failed.",
        },
      }));
    }
  }

  async function onCopyJson() {
    if (jsonDump?.status !== "data") return;
    await navigator.clipboard.writeText(jsonDump.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function onJumpToMatch(e: FormEvent) {
    e.preventDefault();
    const trimmed = jumpToMatchId.trim();
    if (!trimmed) return;
    router.push(`/galaxy/matches/${trimmed}`);
  }

  // Debug tool: raw game_reviews JSON for a matchId/gameIndex, reusing the
  // same route the detail page's client-side loop already calls — no new
  // fetch path. Not meant to replace the PR/mistakes/board view, just a
  // quick way to inspect an event's real shape without leaving the browser.
  async function onShowJsonDump() {
    const trimmedMatchId = jumpToMatchId.trim();
    const trimmedGameIndex = jsonGameIndex.trim();
    if (!trimmedMatchId || !trimmedGameIndex || !token) return;

    setJsonDump({ status: "loading" });
    setCopied(false);

    try {
      const res = await fetch(`/api/galaxy/matches/${trimmedMatchId}/${trimmedGameIndex}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authorization: token }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? `Request failed (${res.status}).`);
      setJsonDump({ status: "data", text: JSON.stringify(json, null, 2) });
    } catch (e) {
      setJsonDump({
        status: "error",
        message: e instanceof Error ? e.message : "Something went wrong.",
      });
    }
  }

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 dark:bg-black">
      <main className="flex w-full max-w-4xl flex-col gap-6 px-6 py-12">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
            Matches
          </h1>

          {token && (
            <form onSubmit={onJumpToMatch} className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={jumpToMatchId}
                onChange={(e) => setJumpToMatchId(e.target.value)}
                placeholder="Match ID"
                className="w-32 rounded-lg border border-black/10 bg-white px-3 py-1.5 text-sm text-black outline-none focus:border-black/30 dark:border-white/15 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-white/30"
              />
              <button
                type="submit"
                className="inline-flex h-9 items-center justify-center rounded-full border border-black/10 px-4 text-sm font-medium text-black transition-colors hover:bg-zinc-100 dark:border-white/15 dark:text-zinc-100 dark:hover:bg-zinc-800"
              >
                Jump to match
              </button>
              <span className="mx-1 h-5 w-px bg-black/10 dark:bg-white/15" />
              <input
                type="text"
                value={jsonGameIndex}
                onChange={(e) => setJsonGameIndex(e.target.value)}
                placeholder="Game"
                title="Game index"
                className="w-16 rounded-lg border border-black/10 bg-white px-3 py-1.5 text-sm text-black outline-none focus:border-black/30 dark:border-white/15 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-white/30"
              />
              <button
                type="button"
                onClick={onShowJsonDump}
                className="inline-flex h-9 items-center justify-center rounded-full border border-black/10 px-4 text-sm font-medium text-black transition-colors hover:bg-zinc-100 dark:border-white/15 dark:text-zinc-100 dark:hover:bg-zinc-800"
              >
                Show JSON
              </button>
            </form>
          )}
        </div>

        {jsonDump && (
          <div className="rounded-lg border border-black/10 bg-white p-3 dark:border-white/15 dark:bg-zinc-900">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Raw JSON — match {jumpToMatchId || "?"} game {jsonGameIndex || "?"}
              </span>
              <div className="flex items-center gap-3">
                {jsonDump.status === "data" && (
                  <button
                    type="button"
                    onClick={onCopyJson}
                    className="text-xs text-zinc-500 underline hover:text-black dark:text-zinc-400 dark:hover:text-zinc-100"
                  >
                    {copied ? "Copied!" : "Copy"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setJsonDump(null)}
                  className="text-xs text-zinc-500 underline hover:text-black dark:text-zinc-400 dark:hover:text-zinc-100"
                >
                  Close
                </button>
              </div>
            </div>
            {jsonDump.status === "loading" && (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Loading…</p>
            )}
            {jsonDump.status === "error" && (
              <p className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
                {jsonDump.message}
              </p>
            )}
            {jsonDump.status === "data" && (
              <pre className="max-h-[60vh] overflow-auto rounded-lg bg-zinc-50 p-3 text-xs text-black dark:bg-black dark:text-zinc-100">
                {jsonDump.text}
              </pre>
            )}
          </div>
        )}

        {!token ? (
          <TokenModal />
        ) : (
          <>
            {loading && (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Loading…</p>
            )}
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
                        <th className="px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Galaxy's analyses/list returns each page sorted
                          ascending by matchId (oldest-in-page first), and
                          the response has no play-timestamp field to sort by
                          instead — matchId descending is the best available
                          proxy for "most recent first" within a page. */}
                      {[...data.analyses]
                        .sort((a, b) => b.matchId - a.matchId)
                        .map((m) => {
                        // Session-local state (this click, this page load)
                        // takes priority; otherwise fall back to the DB
                        // existence check — a match already fully ingested
                        // (in an earlier session, or via a sync script) gets
                        // the same "✓ Synced" treatment without requiring
                        // the user to have clicked Sync just now.
                        const syncState =
                          syncStates[m.matchId] ??
                          (doneMatchIds.has(String(m.matchId))
                            ? ({ status: "synced" } satisfies SyncState)
                            : undefined);
                        return (
                          <tr
                            key={m.matchId}
                            onClick={() => router.push(`/galaxy/matches/${m.matchId}`)}
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
                            <td className="px-3 py-2 text-right">
                              {syncState?.status === "syncing" ? (
                                <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600 dark:border-zinc-600 dark:border-t-zinc-300" />
                                  Syncing…
                                </span>
                              ) : syncState?.status === "synced" ? (
                                <span
                                  className="text-xs font-medium text-green-600 dark:text-green-400"
                                  title="Already synced"
                                >
                                  ✓ Synced
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onSyncMatch(m);
                                  }}
                                  className="rounded-full border border-black/10 px-3 py-1 text-xs font-medium text-black transition-colors hover:bg-zinc-100 dark:border-white/15 dark:text-zinc-100 dark:hover:bg-zinc-800"
                                  title={syncState?.status === "error" ? syncState.message : "Sync this match to the local DB"}
                                >
                                  {syncState?.status === "error" ? "Retry sync" : "Sync"}
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
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
          </>
        )}
      </main>
    </div>
  );
}
