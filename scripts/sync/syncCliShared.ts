// Helpers shared by the three sync CLIs (scripts/sync/runSyncCli.ts for backfill
// and incremental, scripts/sync/retryFailedCli.ts for the DB-only retry):
// argument parsing, the target-DB line and the remote-DB warning.

export interface SyncCliArgs {
  // undefined = no limit.
  limit: number | undefined;
  matchIds?: string[];
  dryRun: boolean;
}

export interface SyncCliArgOptions {
  defaultLimit: number | undefined;
  // Only the DB-only retry takes --match.
  allowMatch: boolean;
}

// `--match` (when allowed) takes every following argument up to the next
// flag, and may be repeated: `--match 1 2 --match 3` -> ["1", "2", "3"].
export function parseSyncCliArgs(
  argv: string[],
  { defaultLimit, allowMatch }: SyncCliArgOptions
): SyncCliArgs | { error: string } {
  let limit = defaultLimit;
  let matchIds: string[] | undefined;
  let dryRun = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--limit") {
      const value = argv[++i];
      if (value === undefined || !/^\d+$/.test(value) || Number(value) < 1) {
        return { error: `--limit needs a positive whole number, got ${value ?? "nothing"}.` };
      }
      limit = Number(value);
    } else if (arg === "--match" && allowMatch) {
      const ids: string[] = [];
      while (i + 1 < argv.length && !argv[i + 1].startsWith("--")) ids.push(argv[++i]);
      if (ids.length === 0) return { error: "--match needs at least one sourceMatchId." };
      matchIds = [...(matchIds ?? []), ...ids];
    } else {
      return { error: `Unknown argument: ${arg}` };
    }
  }

  return { limit, matchIds, dryRun };
}

// Host and database name only; never the credentials.
export function describeDatabaseUrl(url: string | undefined): { host: string; database: string; isLocal: boolean } | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname;
    return {
      host,
      database: parsed.pathname.replace(/^\//, ""),
      isLocal: host === "localhost" || host === "127.0.0.1",
    };
  } catch {
    return null;
  }
}

export function printTarget(env: NodeJS.ProcessEnv): void {
  const db = describeDatabaseUrl(env.DATABASE_URL);
  if (!db) {
    console.log("Target DB: DATABASE_URL is not set or not a valid URL.");
    return;
  }
  console.log(`Target DB: host ${db.host}, database ${db.database}`);
  if (!db.isLocal) {
    console.log(`*** This writes to a remote DB (host ${db.host}). ***`);
  }
}
