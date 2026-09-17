# Progress

Append-only session log. One dated entry per session; if today already has one, add to it instead of creating a new heading.

## 2026-09-17
- What changed: Set up local Postgres + Prisma infra — Docker Compose running Postgres 16 with a named volume and env-based credentials, Prisma initialized (no models yet), connection verified working via a throwaway smoke test.
- What's next: Design the matches/games/decisions schema and run the first migration.
