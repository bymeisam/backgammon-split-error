# Progress

Append-only session log. One dated entry per session; if today already has one, add to it instead of creating a new heading.

## 2026-09-17
- What changed: Set up local Postgres + Prisma infra — Docker Compose running Postgres 16 with a named volume and env-based credentials, Prisma initialized (no models yet), connection verified working via a throwaway smoke test.
- What's next: Design the matches/games/decisions schema and run the first migration.

## 2026-09-18
- What changed: Redid the Postgres + Prisma infra setup (prior version had been reverted). Same result — Docker Compose (Postgres 16, named volume, env-based credentials), Prisma initialized with no models, `/api/db-check` smoke-test route confirmed working — but adapted for Prisma 7: datasource URL now lives in `prisma7.config.ts` (not `schema.prisma`), and the client requires the `@prisma/adapter-pg` driver adapter. Used `prisma init --no-skills` to skip the CLI's agent-skill scaffolding this time.
- What's next: Design the matches/games/decisions schema and run the first migration.
