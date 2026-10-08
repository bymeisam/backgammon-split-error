"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useGameStatsAuth } from "@/app/providers/GameStatsAuthProvider";
import { galaxyPost, jsonOrThrow } from "@/lib/galaxyPost";
import { style } from "./AppNav.styles";

type SyncState =
  | { kind: "idle" }
  | { kind: "syncing" }
  | { kind: "done"; ok: boolean; message: string };

// The navbar's sync line (write mode only). The Galaxy token is the one the
// /galaxy pages already use: GameStatsAuthProvider's in-memory context,
// which wraps the whole app in the root layout — nothing new is stored.
// With a token (pasted on /galaxy/matches this page load), "Sync" runs the
// existing incremental sync route, unchanged. Without one (e.g. after a
// reload), it links to /galaxy/matches to paste it. Once a sync finishes,
// its result message takes the label's place (one bounded slot, so the bar
// can't wrap); the count part is hidden from xl (style.syncCount).
export default function SyncControl({
  lastSyncedWhen,
  lastSyncedCount,
  lastSyncedTitle,
}: {
  lastSyncedWhen: string;
  lastSyncedCount: string;
  lastSyncedTitle: string | undefined;
}) {
  const { token } = useGameStatsAuth();
  const router = useRouter();
  const [state, setState] = useState<SyncState>({ kind: "idle" });

  async function onSync() {
    if (!token) return;
    setState({ kind: "syncing" });
    try {
      const json = (await jsonOrThrow(await galaxyPost("/api/sync/incremental", token))) as {
        message?: string;
      };
      setState({ kind: "done", ok: true, message: json.message ?? "Sync finished." });
      // Re-renders the server components (this line's "Synced …", the
      // due count, the page) with the new data.
      router.refresh();
    } catch (e) {
      setState({ kind: "done", ok: false, message: e instanceof Error ? e.message : "Sync failed." });
    }
  }

  return (
    <div className={style.syncBox} data-testid="sync-control">
      {state.kind === "done" ? (
        <span role="status" title={state.message} className={style.syncMessage(state.ok)}>
          {state.message}
        </span>
      ) : (
        <span className={style.syncLabel} title={lastSyncedTitle}>
          {lastSyncedWhen}
          <span className={style.syncCount}>{lastSyncedCount}</span>
        </span>
      )}
      {token ? (
        <button type="button" onClick={onSync} disabled={state.kind === "syncing"} className={style.syncButton}>
          {state.kind === "syncing" ? "Syncing…" : "Sync"}
        </button>
      ) : (
        <Link
          href="/galaxy/matches"
          title="Paste your Galaxy token on the Galaxy page, then sync from here."
          className={style.syncLink}
        >
          Add token to sync
        </Link>
      )}
    </div>
  );
}
