# Scripts and dead-code audit (2026-10-15)

Read-only audit by the investigator. The main session saved it, because the investigator can't write files. Oracle checks were read-only (`bg_db_ro` via `scripts/ro-query.ts --target oracle`).

## Part A: scripts

All four backfilled values are computed at ingest now, so new rows never need any of the backfills:
- `sourcePositionId` at `lib/ingest.ts:414`;
- `plyNumber` at `:415`;
- `Match.playedAt` at `:442-445`;
- opponent `PlayerIdentity` upsert at `:457`.

| Script | Status | Local | Oracle | Evidence today |
|---|---|---|---|---|
| `backfill-source-position-id.ts` | One-off, done | PROGRESS.md:165 (2026-10-02) | PROGRESS.md:271 (2026-10-03), 1,236,834 rows | `sourcePositionId IS NULL` = 0 |
| `backfill-ply-number.ts` | One-off, done | 2026-09-27 (implied by `docs/field-mapping.md:611`) | archive 2026-09-17-to-09-28 ~:195-200 (2026-09-28), 60,612 changed | 62,002 CHECKER rows with plyNumber set |
| `backfill-played-at.ts` | One-off, done (written as a reconciliation tool for a future rule change) | archive :212-213, PROGRESS.md:403 (0 to change) | archive :212-213 (0 to change) | 82 null `playedAt`: 80 PENDING, 1 FAILED, 1 DONE (known match 6029642). Nothing needs it |
| `backfill-opponent-identities.ts` | One-off, done | archive (2026-09-22): 2,111 created, 2,112 rows | Arrived with the 2026-09-23 data dump (2,112 PlayerIdentities) | 2,162 opponents + 1 `isMe` |
| `recompute-stats.ts` | Keep (tool) | PROGRESS.md:371, :406 | PROGRESS.md:414 (2026-10-07) | Same calls as `lib/sync.ts:654,664`; the only way to rebuild stats after a data fix |
| `sql/app-db-user.sql` | Keep | n/a | PROGRESS.md:959, :972 | `bg_db_app` grants for any new setup; referenced by docs/deploy.md, .env.example, lib/prisma.ts |

These are recurring tools, so keep them:
- the sync CLIs: `backfill.ts`, `incremental-sync.ts`, `retry-failed-matches.ts`, `runSyncCli.ts`, `retryFailedCli.ts`, `syncCliShared.ts` and their tests;
- `design-screenshots.ts`, `sync-agents.ts`, `ro-query.ts`, `galaxy-get.ts`, `check-oracle-cert.ts`, `notes-export.ts` and `notes-import.ts`.

What else has to change when each one-off is removed:
- source-position-id: comment at `prisma/schema.prisma:133`.
- ply-number: history mention at `docs/field-mapping.md:611`, plus cross-reference comments in the other backfill scripts.
- played-at: `package.json` `backfill:played-at`, `docs/field-mapping.md:350` and the comment at `lib/ingest.ts:290`.
- opponent-identities: `package.json` `backfill:opponent-identities`, `docs/field-mapping.md:103, 116, 1100` and the comment at `lib/ingest.ts:450`.

## Part B: dead code

Method: `npx knip` (no config; package.json and the lockfile untouched), then each finding was checked with a repo-wide grep.

**Fully dead** (the name appears only at its definition):
- `allLegalHops`, `lib/checkerMoves.ts:109`
- `addSeatEvidence`, `lib/gnuMatchId.ts:266`

**Export keyword not needed** (live code, used only inside its own file):
- `isForumHandoff`, `ACCESS_RULES`, `galaxyReview` and `cloneCheckerPosition`;
- `isCheckerExplorerComplete`, `KIND_MAP`, `liveDecisionKey` and `DECISION_LIST_SELECT_MEMBER`;
- `SYNC_ERROR_LOG_PATH`, `pickMatchIndexData`, `SEVERITY_PARAM_MAP` and `CATEGORY_PARAM_MAP`;
- `clonePosition`, `validatePosition`, `reviewOptions` and `galaxyStatusItems`;
- `isThemeMode`, `THEME_COOKIE_MAX_AGE_SECONDS`, `GNU_PLAYER_BLACK` and `GNU_PLAYER_WHITE`;
- the `lib/boardGeometry.ts` constants and `severityFor`;
- many exported types.

**Unverified** (common names that grep can't settle): `getGameReviews`, `isObject`, `CARD_STATE_LABEL`, `isThemeId` and `actionLabels`.

**Files:** no orphaned application file. Every file knip flagged is a CLI, a hook, config or a seed.

**Dependencies:** none unused. `server-only` is imported (`lib/app-auth.ts:1`, `lib/forum.ts:1`) but isn't in package.json. It only resolves through Next, so it should be pinned.

## Not checked
- Whether every opponent in `Decision.userId` has a `PlayerIdentity` row on Oracle. That needs a DISTINCT scan of Decision, so it wasn't run.
- Mentions of these scripts in `reports/`.
