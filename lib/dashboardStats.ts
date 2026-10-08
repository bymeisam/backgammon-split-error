// Pure helpers for the home dashboard and the navbar's "last synced" line.
// The queries that feed them are in lib/dashboardQueries.ts.

export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// One grouped row of the weekly-mistakes query: a (kind, severity) pair and
// its count. MySQL's COUNT(*) comes back from $queryRaw as a BigInt.
export interface WeeklyMistakeRow {
  kind: string;
  errorSeverity: string;
  n: bigint | number;
}

export interface MistakeTally {
  errors: number;
  blunders: number;
}

export interface WeeklyMistakes {
  checker: MistakeTally;
  cube: MistakeTally;
  total: MistakeTally;
}

// Folds the grouped rows into the checker/cube × error/blunder grid. Any
// other kind or severity (the query asks for none) is ignored.
export function tallyWeeklyMistakes(rows: readonly WeeklyMistakeRow[]): WeeklyMistakes {
  const checker: MistakeTally = { errors: 0, blunders: 0 };
  const cube: MistakeTally = { errors: 0, blunders: 0 };
  for (const row of rows) {
    const bucket = row.kind === "CHECKER" ? checker : row.kind === "CUBE" ? cube : null;
    if (!bucket) continue;
    const n = Number(row.n);
    if (row.errorSeverity === "ERROR") bucket.errors += n;
    else if (row.errorSeverity === "BLUNDER") bucket.blunders += n;
  }
  return {
    checker,
    cube,
    total: { errors: checker.errors + cube.errors, blunders: checker.blunders + cube.blunders },
  };
}

// "just now", "5 min ago", "3 h ago", "yesterday", "4 days ago" — the
// navbar's "Synced …". A time in the future (clock skew) reads "just
// now".
export function formatTimeAgo(then: Date, now: Date): string {
  const ms = now.getTime() - then.getTime();
  if (ms < 60_000) return "just now";
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 24) return `${hours} h ago`;
  // Calendar days between the two local dates.
  const startNow = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startThen = new Date(then.getFullYear(), then.getMonth(), then.getDate()).getTime();
  const days = Math.round((startNow - startThen) / 86_400_000);
  if (days <= 1) return "yesterday";
  return `${days} days ago`;
}

// The navbar's sync line: "Synced 5 min ago · 3 matches" /
// "Never synced".
export function lastSyncedLabel(
  run: { finishedAt: Date; matchesSynced: number } | null,
  now: Date
): string {
  if (!run) return "Never synced";
  const matches = `${run.matchesSynced} match${run.matchesSynced === 1 ? "" : "es"}`;
  return `Synced ${formatTimeAgo(run.finishedAt, now)} · ${matches}`;
}
