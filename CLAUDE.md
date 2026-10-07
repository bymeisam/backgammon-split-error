@AGENTS.md

## Purpose

This app is a personal training tool. The user is building it to improve their own backgammon. It lets them:
- review the games they've played;
- find their repeated mistakes, and their mistakes at each stage of the game;
- study those mistakes with an Anki-style spaced-repetition review, with their own notes giving the reasoning.

New games are synced every day, so there's plenty of data. Judge features and data fixes by whether they help with that. Imperfect or unanalysed data that never shows up in the user's error and blunder lists doesn't need special handling (exclusion flags, filters, clean-up). Don't build machinery for it unless asked.

See PROGRESS.md for session-by-session history before starting new work.

After completing a meaningful piece of work — a schema change, a working feature, a fixed bug, not every small edit — append a dated entry to PROGRESS.md summarizing what changed and what's next. If today's date already has an entry, add to it rather than creating a duplicate heading.

Any new column storing an externally-sourced string identifier (user ID, match ID, event ID, etc. from Galaxy or any future data source) must be pinned to a case-sensitive/binary collation at the time it's added, unless it's a numeric type (e.g. BigInt), which needs no collation at all — see docs/field-mapping.md for the current list and full reasoning. Don't rely on the database's default collation for these.

Note: MySQL collation cannot be set via Prisma's schema DSL — it must be hand-added as `COLLATE utf8mb4_bin` directly in the generated migration SQL, with a comment explaining why (see docs/field-mapping.md). Check that any migration touching these columns preserves this by hand.

`/galaxy/*` pages (and `/api/galaxy/*`) show data fetched live from Galaxy's website, not from our DB. They are read-only views: never attach user-authored data (notes, tags, etc.) or any other app write to them. User features go on DB-backed views only, such as /matches, /mistakes, /repeated-positions and the replay.

`/status` (app/status/page.tsx) is a live snapshot — stack/DB versions, connection health, row counts, and latest migration are all read live and need no maintenance. After a change to the stack, DB engine, auth model, or overall architecture (not every feature — this is a much narrower trigger than the PROGRESS.md one above), update app/status/notes.ts so the page's "Notes" section stays accurate.

## Working with agents

The main session advises, plans and orchestrates. Two subagents do the work: `investigator` (read-only, in `.claude/agents/investigator.md`) and `developer` (implements approved specs, in `.claude/agents/developer.md`).

- Discuss ideas with the user first. Don't start implementing from a discussion.
- Send factual questions about the code, the data or Galaxy to the investigator. Don't answer them from assumption.
- Write a plan and wait for the user's explicit approval before handing anything to the developer.
- Give the developer a self-contained spec. It sees only what you pass it, not this conversation.
- PROGRESS.md must be updated after every batch of work (see the rule above). The developer does it as part of each task. The main session checks the developer's report says it did, and adds an entry itself for work done outside the developer (for example, a CLAUDE.md or docs change).
- After the developer reports, send the investigator to check its claims against real data before you tell the user the work is done.
- **Never touch `.env*`** (`.env.example` excepted). That covers the main session and both agents, and it means no edits, no switching, and no "restoring to local". When `.env` needs a change, tell the user exactly what to change, and the user does it. It stays however the user left it until the user changes it. Edits are denied in `.claude/settings.json`, but a Bash command can still write to it, so the rule is what matters.
- **No Oracle changes without the user's explicit approval, every time.** That covers migrations, backfills, writes and admin credentials. It applies even when `.env` already points at Oracle: the user leaving `.env` on Oracle is not approval. Ask first, with the exact commands. Read-only investigator queries to Oracle (`bg_db_ro`) are fine.
- Nobody pushes. The user pushes after reviewing. `git push` is denied in `.claude/settings.json`.
- Subagents don't spawn subagents. Neither agent has the `Agent` tool, so every handoff goes through the main session.
