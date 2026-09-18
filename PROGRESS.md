# Progress

Append-only session log. One dated entry per session; if today already has one, add to it instead of creating a new heading.

## 2026-09-17
- What changed: Set up local Postgres + Prisma infra — Docker Compose running Postgres 16 with a named volume and env-based credentials, Prisma initialized (no models yet), connection verified working via a throwaway smoke test.
- What's next: Design the matches/games/decisions schema and run the first migration.

## 2026-09-18
- What changed: Redid the Postgres + Prisma infra setup (prior version had been reverted). Same result — Docker Compose (Postgres 16, named volume, env-based credentials), Prisma initialized with no models, `/api/db-check` smoke-test route confirmed working — but adapted for Prisma 7: datasource URL now lives in `prisma7.config.ts` (not `schema.prisma`), and the client requires the `@prisma/adapter-pg` driver adapter. Used `prisma init --no-skills` to skip the CLI's agent-skill scaffolding this time.
- What changed: Split the single `/game_reviews` page into `/matches` (paginated match list from Galaxy's `analyses/list/{page}`) and `/matches/[matchId]` (the existing PR/mistakes analysis, moved as-is). Added `GameStatsProvider`/`useGameStatsAuth()` — an in-memory-only auth context shared across both pages, deliberately not named `AuthProvider`/`useAuth` to leave room for real app auth later — and a blocking `TokenModal` that gates `/matches` until a token is entered. `analyses/list` request URL was assumed (not confirmed against a real call) to live at the same host/prefix as `game_reviews`; flagged as unverified.
- What's next: Design the matches/games/decisions schema and run the first migration. Confirm the `analyses/list/{page}` request URL against a real token/response — current implementation is an educated guess based on the `game_reviews` endpoint's pattern.
- What changed: Defined the `Match`/`Game`/`Decision` Prisma schema and applied the first migration (`init_schema`) against local Postgres — confirmed live this time, Docker Desktop turned out to already be installed and running, just not on `PATH`. Final schema: `Match.playedAt` (nullable, filled at detail ingest) plus `createdAt` (ingest timestamp) kept distinct; `mwc` promoted to its own nullable column on `Decision`; `Decision.raw` holds the complete original event object (not just `reviews[0]`) as the zero-blind-spot archive; indexes on `(kind, classification)` and `userId`. Verified table structure directly via `psql \d`.
- What's next: Build the index-sync job (match list ingest → `Match` rows) and the detail-ingest job (per-match `game_reviews` fetch → `Game`/`Decision` rows, filling in both `playedAt` fields). `analyses/list/{page}` URL still unconfirmed against a real response (see above).
