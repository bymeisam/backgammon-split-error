<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Repo rules (shared by every coding tool)

## Purpose

This app is a personal training tool. The user is building it to improve their own backgammon. It lets them:
- review the games they've played;
- find their repeated mistakes, and their mistakes at each stage of the game;
- study those mistakes with an Anki-style spaced-repetition review, with their own notes giving the reasoning.

It is still the user's training tool, now also shared read-only with invited members (matches, mistakes, repeated positions), who also use the forum; review, notes, tags and sources stay the owner's alone (`lib/accessRules.ts`).

New games are synced every day, so there's plenty of data. Judge features and data fixes by whether they help with that. Imperfect or unanalysed data that never shows up in the user's error and blunder lists doesn't need special handling (exclusion flags, filters, clean-up). Don't build machinery for it unless asked.

Start a session by reading `docs/current-state.md` (a short snapshot of where things stand). Don't read `PROGRESS.md` at the start of a session. It's the history log, so read it only when you need it: grep it (and `docs/progress-archive/`) for the history behind something, for example why a decision was made, or what has already been run on Oracle.

After completing a meaningful piece of work — a schema change, a working feature, a fixed bug, not every small edit — append a dated entry to PROGRESS.md summarizing what changed and what's next. If today's date already has an entry, add to it rather than creating a duplicate heading.

Any new column storing an externally-sourced string identifier (user ID, match ID, event ID, etc. from Galaxy or any future data source) must be pinned to a case-sensitive/binary collation at the time it's added, unless it's a numeric type (e.g. BigInt), which needs no collation at all — see docs/field-mapping.md for the current list and full reasoning. Don't rely on the database's default collation for these.

Note: MySQL collation cannot be set via Prisma's schema DSL — it must be hand-added as `COLLATE utf8mb4_bin` directly in the generated migration SQL, with a comment explaining why (see docs/field-mapping.md). Check that any migration touching these columns preserves this by hand.

## Schema rule: columns must earn their place

`raw` is the source's untouched payload. Never modify it. By default, any value the app needs is worked out from `raw` when it's needed, through that source's translator (the pattern is `lib/analysis/index.ts`'s `getDecisionAnalysis`). A value becomes a stored column only when at least one of these is true:
1. SQL filters, sorts, groups or counts by it, including indexes and precomputed stats.
2. Working it out needs other rows (e.g. `roll` and `plyNumber`), so storing it once at sync time avoids recomputing across rows.
3. A view shows many rows without loading `raw`.

When proposing a new column, say which of these it meets. Don't add columns ahead of a real need. Promote a value to a column deliberately when one of these appears (that means a migration plus a backfill, local first, then Oracle).

`/sources/galaxy/*` pages (old `/galaxy/*` URLs redirect there) and `/api/galaxy/*` show data fetched live from Galaxy's website, not from our DB. They are read-only views: never attach user-authored data (notes, tags, etc.) or any other app write to them. User features go on DB-backed views only, such as /matches, /mistakes, /repeated-positions and the replay.

`/status` (app/status/page.tsx) is a live snapshot — stack/DB versions, connection health, row counts, and latest migration are all read live and need no maintenance. After a change to the stack, DB engine, auth model, or overall architecture (not every feature — this is a much narrower trigger than the PROGRESS.md one above), update app/status/notes.ts so the page's "Notes" section stays accurate.

## Working with agents

The main session advises, plans and orchestrates. Four subagents do the work. Their instructions are written once in `agents/roles/<role>/` and generated into each tool's agent folder by `npm run agents:sync`; edit the role sources, never the generated files.
- **`investigator`** (`agents/roles/investigator/`): read-only.
- **`developer`** (`agents/roles/developer/`): implements approved specs.
- **`designer`** (`agents/roles/designer/`): UI/UX reviewer. It studies screenshots (made by `scripts/design-screenshots.ts`) and the styling code, and writes design reports to `reports/` and mockups to `design/mockups/`. It proposes and never implements: app-code changes go through the usual plan → user approval → developer flow.
- **`architect`** (`agents/roles/architect/`): read-only architecture advisor, on demand for cross-cutting design decisions.
- **When the designer reviews.** If a change **adds a new page or a new kind of visible component** (e.g. a new drill screen, a new card type, a new panel), the developer takes screenshots with `scripts/design-screenshots.ts` and the designer reviews them before the work counts as done. Small UI tweaks, logic-only changes and data work skip this. The automatic guardrails (`docs/design-system.md`, the `styling-conventions` skill, the shared `app/components/ui/` components, the style-guard test and the visual suite) cover everyday consistency.
- **Guards.** Claude Code enforces each agent's limits with guard hooks (`.claude/hooks/`). omp does not yet, so omp agents rely on their written rules and `tools:` lists.

- **One batch of work per session.** Everything in a session is re-sent on every turn, so a session that runs for days gets expensive on every call. When a batch is done (developer reported, investigator checked, PROGRESS.md updated), rewrite `docs/current-state.md` and tell the user it's a good point to clear the session.
- **Keep handoffs lean.** Agents re-send everything they've loaded on every call. In specs and questions, name the exact files and sections (for example "docs/field-mapping.md § Decision") so agents don't explore. Keep developer specs to one phase per run.
- Discuss ideas with the user first. Don't start implementing from a discussion.
- Send factual questions about the code, the data or Galaxy to the investigator. Don't answer them from assumption.
- Write a plan and wait for the user's explicit approval before handing anything to the developer.
- Give the developer a self-contained spec. It sees only what you pass it, not this conversation.
- PROGRESS.md must be updated after every batch of work (see the rule above). The developer does it as part of each task. The main session checks the developer's report says it did, and adds an entry itself for work done outside the developer (for example, an AGENTS.md or docs change).
- After the developer reports, send the investigator to check its claims against real data before you tell the user the work is done.
- **Never touch `.env*`** (`.env.example` excepted). That covers the main session and every agent, and it means no edits, no switching, and no "restoring to local". When `.env` needs a change, tell the user exactly what to change, and the user does it. It stays however the user left it until the user changes it.
- **No Oracle changes without the user's explicit approval, every time.** That covers migrations, backfills, writes and admin credentials. It applies even when `.env` already points at Oracle: the user leaving `.env` on Oracle is not approval. Ask first, with the exact commands. Read-only investigator queries to Oracle (`bg_db_ro`) are fine.
- Nobody pushes. The user pushes after reviewing.
- Subagents don't spawn subagents. None of them has a tool for it, so every handoff goes through the main session.
