@AGENTS.md

See PROGRESS.md for session-by-session history before starting new work.

After completing a meaningful piece of work — a schema change, a working feature, a fixed bug, not every small edit — append a dated entry to PROGRESS.md summarizing what changed and what's next. If today's date already has an entry, add to it rather than creating a duplicate heading.

Any new column storing an externally-sourced string identifier (user ID, match ID, event ID, etc. from Galaxy or any future data source) must be pinned to a case-sensitive/binary collation at the time it's added, unless it's a numeric type (e.g. BigInt), which needs no collation at all — see docs/field-mapping.md for the current list and full reasoning. Don't rely on the database's default collation for these.

Note: MySQL collation cannot be set via Prisma's schema DSL — it must be hand-added as `COLLATE utf8mb4_bin` directly in the generated migration SQL, with a comment explaining why (see docs/field-mapping.md). Check that any migration touching these columns preserves this by hand.

`/status` (app/status/page.tsx) is a live snapshot — stack/DB versions, connection health, row counts, and latest migration are all read live and need no maintenance. After a change to the stack, DB engine, auth model, or overall architecture (not every feature — this is a much narrower trigger than the PROGRESS.md one above), update app/status/notes.ts so the page's "Notes" section stays accurate.
