"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useGameStatsAuth } from "@/app/GameStatsProvider";
import type { AnalysesListResponse, MatchAnalysis } from "@/lib/analysesTypes";
import { galaxyPost, jsonOrThrow } from "@/lib/galaxyPost";
import Pager from "@/app/components/ui/Pager";
import { style } from "./galaxyMatches.styles";
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

    async function run(token: string) {
      setLoading(true);
      setError(null);

      try {
        const json = await jsonOrThrow(await galaxyPost(`/api/galaxy/matches/list/${page}`, token));
        if (!cancelled) setData(json as AnalysesListResponse);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Something went wrong.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run(token);

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
      const res = await galaxyPost(`/api/galaxy/matches/${match.matchId}/sync`, token, {
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
      });
      const json = (await jsonOrThrow(res)) as { gamesIngested: number; errors?: string[] };

      // A 200 here just means the sync ran — if it ingested nothing and has
      // errors, that's a real failure (e.g. a bad/expired token), not a
      // success with an empty match.
      if (json.gamesIngested === 0 && json.errors && json.errors.length > 0) {
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
      const json = await jsonOrThrow(
        await galaxyPost(`/api/galaxy/matches/${trimmedMatchId}/${trimmedGameIndex}`, token)
      );
      setJsonDump({ status: "data", text: JSON.stringify(json, null, 2) });
    } catch (e) {
      setJsonDump({
        status: "error",
        message: e instanceof Error ? e.message : "Something went wrong.",
      });
    }
  }

  return (
    <div className={style.pageContainer}>
      <main className={style.main}>
        <div className={style.headerRow}>
          <h1 className={style.title}>
            Matches
          </h1>

          {token && (
            <form onSubmit={onJumpToMatch} className={style.jumpForm}>
              <input
                type="text"
                value={jumpToMatchId}
                onChange={(e) => setJumpToMatchId(e.target.value)}
                placeholder="Match ID"
                className={style.matchIdInput}
              />
              <button
                type="submit"
                className={style.pillButton}
              >
                Jump to match
              </button>
              <span className={style.divider} />
              <input
                type="text"
                value={jsonGameIndex}
                onChange={(e) => setJsonGameIndex(e.target.value)}
                placeholder="Game"
                title="Game index"
                className={style.gameIndexInput}
              />
              <button
                type="button"
                onClick={onShowJsonDump}
                className={style.pillButton}
              >
                Show JSON
              </button>
            </form>
          )}
        </div>

        {jsonDump && (
          <div className={style.jsonBox}>
            <div className={style.jsonBoxHeader}>
              <span className={style.jsonBoxLabel}>
                Raw JSON — match {jumpToMatchId || "?"} game {jsonGameIndex || "?"}
              </span>
              <div className={style.jsonBoxActions}>
                {jsonDump.status === "data" && (
                  <button
                    type="button"
                    onClick={onCopyJson}
                    className={style.jsonLinkButton}
                  >
                    {copied ? "Copied!" : "Copy"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setJsonDump(null)}
                  className={style.jsonLinkButton}
                >
                  Close
                </button>
              </div>
            </div>
            {jsonDump.status === "loading" && (
              <p className={style.mutedText}>Loading…</p>
            )}
            {jsonDump.status === "error" && (
              <p className={style.errorBox}>
                {jsonDump.message}
              </p>
            )}
            {jsonDump.status === "data" && (
              <pre className={style.jsonPre}>
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
              <p className={style.mutedText}>Loading…</p>
            )}
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
                      <tr className={style.theadRow}>
                        <th className={style.headCell}>Opponent</th>
                        <th className={style.headCell}>Rating</th>
                        <th className={style.headCell}>Score</th>
                        <th className={style.headCell}>Your error</th>
                        <th className={style.headCell}>Opponent error</th>
                        <th className={style.headCell}></th>
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
                            className={style.bodyRow}
                          >
                            <td className={style.opponentCell}>{m.opponentName}</td>
                            <td className={style.monoCell}>
                              {m.opponentRating}
                            </td>
                            <td className={style.monoCell}>
                              {m.userScore}–{m.opponentScore}
                            </td>
                            <td className={style.monoCell}>
                              {m.userError.toFixed(3)}
                            </td>
                            <td className={style.monoCell}>
                              {m.opponentError.toFixed(3)}
                            </td>
                            <td className={style.actionCell}>
                              {syncState?.status === "syncing" ? (
                                <span className={style.syncingLabel}>
                                  <span className={style.spinner} />
                                  Syncing…
                                </span>
                              ) : syncState?.status === "synced" ? (
                                <span
                                  className={style.syncedLabel}
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
                                  className={style.syncButton}
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

                <Pager page={page} shownPage={data.page} totalPages={data.totalPages} setPage={setPage} />
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
