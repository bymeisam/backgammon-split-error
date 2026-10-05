# Agent setup report: 2026-10-06

Scope: the uncommitted agent setup, which is `.claude/agents/{investigator,developer}.md`, `.claude/hooks/*-guard.mjs`, `.claude/settings.json`, `scripts/ro-query.ts`, `scripts/galaxy-get.ts`, and the "Working with agents" section of CLAUDE.md.

## Roster

| | investigator | developer |
|---|---|---|
| Role | Answers factual questions about the code, the data and Galaxy. Verifies the developer's claims. | Implements one approved spec, runs the checks, commits locally. |
| Tools | Read, Grep, Glob, Bash, WebFetch, WebSearch (no Edit or Write) | Read, Grep, Glob, Edit, Write, Bash, Skill |
| Preloaded skill | styling-conventions | styling-conventions |
| Hook | `investigator-guard.mjs` on Bash | `developer-guard.mjs` on Bash, Edit and Write |
| DB access | Only `scripts/ro-query.ts` (`bg_db_ro`, READ ONLY session, one SELECT-type statement per call) | Local DB through Prisma or scripts, and only while `DATABASE_URL` is localhost |
| Oracle | Read-only queries allowed. EXPLAIN required for new `Decision` queries. | Blocked. It prepares the commands and stops. |
| Output | Question / Method / Findings (each labelled `[verified: external]` or `[inferred: stored data]`) / Not checked / Open questions | What changed / Verified / Not verified / Uncommitted / PROGRESS.md + commit hash |

## Layers of enforcement

1. **Instructions.** These are the agent prompts and CLAUDE.md.
2. **Tool allowlist.** The investigator has no Edit or Write tool. Neither agent has the Agent tool.
3. **PreToolUse hooks.** These match patterns. They are a backstop, not a sandbox.
4. **`settings.json` deny rules.** These cover `git push` and `Edit(.env*)`.
5. **Server-side grants.** `bg_db_ro` is SELECT-only, and `ro-query.ts` refuses every user except `bg_db_ro`.

## What works well

- **The read-only DB path is solid.** `ro-query.ts` combines a user check, a localhost check for `--target local`, a READ ONLY session, a statement allowlist and a ban on multiple statements. `--grant-check` is refused for Oracle.
- **The Oracle gate in the developer guard depends on where `.env` actually points.** The hook reads `DATABASE_URL` itself. Whenever that is not localhost, it blocks prisma, `scripts/`, seed, `npm run dev/start/backfill/sync*` and `next dev/start`. It also blocks any command that mentions Oracle credentials or the Oracle host.
- **`.env` is protected from Bash in both agents.** Quoted strings are stripped before matching, so a commit message that mentions `.env` is not blocked.
- **The investigator guard covers the common ways to write.** It catches state-changing git commands, file-changing commands, redirects, `sed -i`, package installs, prisma migrate/db/generate, direct DB clients and docker. Code execution is limited to the three read-only scripts.
- **Visual tests are isolated.** Playwright runs its own server on :3100 with `.env.test`, so `npm run test:visual` cannot reach Oracle through `.env`.

## Gaps and risks (most important first)

1. **The Read tool can open `.env`.** Both agents have Read. The investigator hook only watches Bash, and the developer hook only watches Bash, Edit and Write. `settings.json` denies `Edit(.env*)` but has no deny rule for `Read`. Today the only thing stopping an agent from reading credentials into its context is the prompt. Fix: add `Read(.env)`, `Read(.env.*)` and `Read(!.env.example)` to the deny list, in that order. The scripts and the guard hooks open `.env` in their own processes, which these rules don't cover, so they keep working.
2. ~~**`Edit(!.env.example)` probably does not do what it intends.**~~ **Retracted.** The permissions docs (code.claude.com/docs/en/permissions) say that in a `deny` list, a pattern starting with `!` is a gitignore negation. It exempts the paths it matches from the rules listed before it in the same settings file. So `Edit(.env.*)` followed by `Edit(!.env.example)` works as intended. The same docs say Read and Edit deny rules also apply to the commands Claude Code recognises in Bash, such as `cat`, `head` and `sed`, and to redirect targets.
3. **The developer prompt contradicts itself on checking `DATABASE_URL`.** It says to check which host `DATABASE_URL` targets "without reading `.env`", and to stop if you can't tell. The agent has no way to tell, so a strict reading means it should stop before every local migration or backfill. In practice the hook does this check. Fix: change the prompt to say "the guard hook checks this. If a DB command isn't blocked, `.env` is local."
4. **`npm test` is not covered by either guard.** The investigator guard blocks `npm run test` but not the shorter `npm test`, which runs vitest and may write snapshots or touch a database. I did not check whether any vitest test touches a database. The developer is supposed to run it, so this only matters for the investigator.
5. **Smaller ways around the investigator guard.** None of these are blocked: `git diff --output=<file>`, `npx prisma studio`, shell globs such as `cat .en?`, and `$VAR` indirection. These are accepted backstop limits, but they are listed here so nobody mistakes the guard for a sandbox.
6. **The investigator preloads `styling-conventions`.** This is harmless but adds context it rarely needs. Keep it only if the investigator is expected to review styling.

## Follow-up after the fixes

The investigator checked the developer's edits against the files. The `settings.json` deny list, the `developer.md` change and the PROGRESS.md line are all correct. The Read tool can still open `.env.example`, and `ro-query.ts --target local "SELECT 1"` still works.

The investigator also found a new problem: **the new `developer.md` sentence overstates the hook.** It says "If a DB command runs, `.env` is local", but the guard is only a regex (`developer-guard.mjs:58`) and misses some commands:
- `npm start`, because the regex expects `npm run start`.
- `npx tsx` or `node` on files outside `scripts/`, including inline `-e` code.
- `cd scripts && npx tsx …`, because the regex needs the `scripts/` slash.
- `curl` to the write routes of a dev server that is already running.

It also assumes "local" in several cases:
- `.env` is missing or can't be parsed (the catch block at lines 51–53).
- `.env` contains `export DATABASE_URL=…`.
- `DATABASE_URL` appears twice in `.env`. The hook reads the first, but dotenv uses the last.
- `DATABASE_URL` is exported in the shell.
- A `.env.local` file is present.

Playwright, `e2e/seed-test-db.ts`, `npm test` and `npm run build` are low risk: Playwright and the seed script use `.env.test`, the vitest tests mock prisma, and the Prisma pages are force-dynamic.

## Status

- None of this is committed yet. `.claude/agents/`, `.claude/hooks/`, `.claude/settings.json`, `scripts/galaxy-get.ts` and `scripts/ro-query.ts` are untracked. CLAUDE.md, PROGRESS.md, `.env.example` and `docs/field-mapping.md` are modified.
- Nothing has been changed as a result of this report. Fixing gaps 1 and 3 is a small change to settings and a prompt, and it needs your approval before it goes to the developer. Gap 2 needs no fix.
