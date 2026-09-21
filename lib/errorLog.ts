// File-based full-detail error log for the local sync scripts
// (scripts/backfill.ts, scripts/incremental-sync.ts, both via
// scripts/runSyncCli.ts) — appended to from runSync's existing per-match
// FAILED path, purely additive to the short console.error line that's
// already there. Terminal scrollback truncates on a long run; this is
// where the full detail (stack trace included) survives.
//
// Local file only, on purpose — no external logging service/SDK. Writes are
// wrapped so a filesystem problem (e.g. a read-only filesystem, since
// runSync is also called from the Vercel API route) never breaks the sync
// itself — this is best-effort visibility, not a hard dependency.
import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

export const SYNC_ERROR_LOG_RELATIVE_PATH = "logs/sync-errors.log";
export const SYNC_ERROR_LOG_PATH = path.join(process.cwd(), SYNC_ERROR_LOG_RELATIVE_PATH);

export interface SyncErrorLogEntry {
  matchId: number;
  // The full error message — for a per-event ingest failure this already
  // embeds "game {gameIndex} event {eventId}: ..." (see lib/ingest.ts),
  // since runSync's catch block only ever sees the already-joined message,
  // not separately structured gameIndex/eventId fields.
  message: string;
  stack?: string;
}

export async function appendSyncErrorLog(entry: SyncErrorLogEntry): Promise<void> {
  try {
    await mkdir(path.dirname(SYNC_ERROR_LOG_PATH), { recursive: true });
    const line = JSON.stringify({
      timestamp: new Date().toISOString(),
      matchId: entry.matchId,
      message: entry.message,
      stack: entry.stack ?? null,
    });
    await appendFile(SYNC_ERROR_LOG_PATH, line + "\n", "utf8");
  } catch (e) {
    console.warn(
      `Failed to write to ${SYNC_ERROR_LOG_RELATIVE_PATH}: ${e instanceof Error ? e.message : "unknown error"}`
    );
  }
}
