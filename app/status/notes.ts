// Facts about the current architecture that can't be derived live (unlike
// the rest of /status, which reads package.json/DATABASE_URL/Prisma
// directly). Keep this short — only update it when something at this level
// actually changes (a new data source, an auth system landing, another
// engine swap), not for every feature. See CLAUDE.md.
export const STATUS_NOTES: string[] = [
  "MySQL 8, not Postgres — targeting Oracle HeatWave's 50 GB Always Free tier as the eventual host.",
  "No app-level authentication yet — the Galaxy API token lives in memory only (GameStatsProvider), cleared on every page reload by design.",
  "Two parallel data sources: /matches (DB-backed, default, no token needed) and /galaxy/matches (live Galaxy fetch, requires a pasted token, has the manual per-row Sync button).",
  "Externally-sourced string identifier columns (Match.sourceMatchId, PlayerIdentity.sourceUserId, Decision.userId, Decision.cubeOwnerUserId) are pinned to a case-sensitive/binary collation by hand-editing migration SQL — see docs/field-mapping.md.",
];
