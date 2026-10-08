"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useGameStatsAuth } from "@/app/providers/GameStatsAuthProvider";
import type { AnalysesListResponse, MatchAnalysis } from "@/lib/analysesTypes";
import { galaxyPost, jsonOrThrow } from "@/lib/galaxyPost";
import {
  interpretSyncResponse,
  resolveSyncState,
  sortNewestFirst,
  type SyncState,
} from "@/lib/galaxyMatchList";
import Pager from "@/app/components/ui/Pager";
import PageShell from "@/app/components/ui/PageShell";
import { style } from "./galaxyMatches.styles";
import JsonDumpPanel, { useJsonDump } from "./JsonDumpPanel";
import TokenModal from "./TokenModal";

const NO_DONE_IDS: ReadonlySet<string> = new Set();

export default function GalaxyMatchesPage() {
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
  // Stored with the `data` it was checked for, so a result for a previous
  // page (or none yet) reads as empty rather than needing a reset.
  const [doneCheck, setDoneCheck] = useState<{ for: AnalysesListResponse; ids: Set<string> } | null>(null);
  const doneMatchIds = doneCheck && doneCheck.for === data ? doneCheck.ids : NO_DONE_IDS;
  const [jumpToMatchId, setJumpToMatchId] = useState("");
  const [jsonGameIndex, setJsonGameIndex] = useState("1");
  const jsonDump = useJsonDump(token);

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
    if (!data || data.analyses.length === 0) return;

    let cancelled = false;

    async function run(data: AnalysesListResponse) {
      try {
        const matchIds = data.analyses.map((m) => m.matchId).join(",");
        const res = await fetch(`/api/matches/check-existence?matchIds=${matchIds}`);
        if (!res.ok) throw new Error(`Request failed (${res.status}).`);
        const json = await res.json();
        if (!cancelled) setDoneCheck({ for: data, ids: new Set(json.done as string[]) });
      } catch (e) {
        console.error("Failed to check existing matches:", e);
      }
    }

    run(data);

    return () => {
      cancelled = true;
    };
  }, [data]);

  // Per-match, button-triggered sync. Deliberately structured as a handler
  // over a single matchId (not a loop) — a later "sync all new" button can
  // just call this once per match without any rewrite here.
  async function onSyncMatch(match: MatchAnalysis) {
    if (!token) return;

    const setSyncState = (state: SyncState) =>
      setSyncStates((prev) => ({ ...prev, [match.matchId]: state }));
    setSyncState({ status: "syncing" });

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
      setSyncState(interpretSyncResponse(await jsonOrThrow(res)));
    } catch (e) {
      setSyncState({ status: "error", message: e instanceof Error ? e.message : "Sync failed." });
    }
  }

  function onJumpToMatch(e: FormEvent) {
    e.preventDefault();
    const trimmed = jumpToMatchId.trim();
    if (!trimmed) return;
    router.push(`/galaxy/matches/${trimmed}`);
  }

  return (
    <PageShell
      width="medium"
      title="Matches"
      actions={
        token && (
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
              onClick={() => jsonDump.show(jumpToMatchId, jsonGameIndex)}
              className={style.pillButton}
            >
              Show JSON
            </button>
          </form>
        )
      }
    >
      {jsonDump.dump && (
        <JsonDumpPanel
          dump={jsonDump.dump}
          copied={jsonDump.copied}
          onCopy={jsonDump.copy}
          onClose={jsonDump.close}
          matchId={jumpToMatchId}
          gameIndex={jsonGameIndex}
        />
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
                    {sortNewestFirst(data.analyses).map((m) => {
                      const syncState = resolveSyncState(syncStates, doneMatchIds, m.matchId);
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
                            {m.userError.toFixed(2)}
                          </td>
                          <td className={style.monoCell}>
                            {m.opponentError.toFixed(2)}
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
    </PageShell>
  );
}
