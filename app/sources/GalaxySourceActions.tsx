"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useGameStatsAuth } from "@/app/providers/GameStatsAuthProvider";
import { galaxyPost, jsonOrThrow } from "@/lib/galaxyPost";
import TokenModal from "@/app/components/galaxy/TokenModal";
import Button from "@/app/components/ui/Button";
import { style } from "./sources.styles";

type SyncState =
  | { kind: "idle" }
  | { kind: "syncing" }
  | { kind: "done"; ok: boolean; message: string };

// The Galaxy card's actions on /sources (moved here from the navbar's sync
// line, SyncControl, on 2026-10-09). The token is GameStatsAuthProvider's
// in-memory one, the same the matches pages use; nothing new is stored.
// Without a token, "Add token" opens the existing TokenModal (dismissible
// here). With one, "Sync" runs the unchanged incremental sync route and its
// result message stays on the card. `children` are the card's links
// (Browse matches →), kept in the same row.
export default function GalaxySourceActions({ children }: { children?: ReactNode }) {
  const { token } = useGameStatsAuth();
  const router = useRouter();
  const [state, setState] = useState<SyncState>({ kind: "idle" });
  const [adding, setAdding] = useState(false);

  async function onSync() {
    if (!token) return;
    setState({ kind: "syncing" });
    try {
      const json = (await jsonOrThrow(await galaxyPost("/api/sync/incremental", token))) as {
        message?: string;
      };
      setState({ kind: "done", ok: true, message: json.message ?? "Sync finished." });
      // Re-renders the server components (the card's status facts, the
      // navbar's due count) with the new data.
      router.refresh();
    } catch (e) {
      setState({ kind: "done", ok: false, message: e instanceof Error ? e.message : "Sync failed." });
    }
  }

  return (
    <div className={style.actionsBlock}>
      <div className={style.actionsRow}>
        {token ? (
          <Button variant="primary" size="compact" onClick={onSync} disabled={state.kind === "syncing"}>
            {state.kind === "syncing" ? "Syncing…" : "Sync"}
          </Button>
        ) : (
          <Button variant="primary" size="compact" onClick={() => setAdding(true)}>
            Add token
          </Button>
        )}
        {children}
      </div>
      {state.kind === "done" && (
        <p role="status" data-testid="source-sync-message" className={style.syncMessage(state.ok)}>
          {state.message}
        </p>
      )}
      {adding && !token && <TokenModal onCancel={() => setAdding(false)} />}
    </div>
  );
}
