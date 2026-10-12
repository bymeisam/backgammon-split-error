# Current state

Start each new session here. `PROGRESS.md` is the history log: grep it only when you need the history behind something. `/wrap-up` rewrites this file at the end of each batch of work. Keep it under about a page: it's a snapshot, not history.

_Last updated: 2026-10-13, seeded from PROGRESS.md and git. Oracle state wasn't re-checked for this seed. Ask the investigator if it matters._

## Code

- `master` is clean and in sync with `origin/master`. Last commit: `5847c49` (2026-10-09), "Board chips: the single review chip reads 'Yours [Best]'; moves line up".
- Last finished batch: the design review's 7 fixes (review back, navbar breakpoints and order, Sources card, board chips). Committed and pushed.
- **Uncommitted, waiting for the user's review:** the 2026-10-13 context-usage changes (see that PROGRESS.md entry): `.claude/settings.json`, `.claude/agents/{developer,investigator}.md`, `.claude/commands/wrap-up.md`, `CLAUDE.md`, `PROGRESS.md`, the new `docs/current-state.md` and `docs/progress-archive/`. Commit them once the user has reviewed them.

## Open threads

- **Designer:** look at the 2026-10-09 screenshots (`design/screenshots/2026-10-09-sources-fixes/`), including the follow-up chip fix in `5847c49`.
- **Needs the user's `.env`:** a 1024px navbar screenshot in the "Writes: Oracle · Reads: Local" state.
- **Ongoing, no batch of its own:** move hand-composed buttons, tables and cards onto `app/components/ui/` whenever those files are touched (for example the modal buttons, BulkAddToReview, and the matches and dashboard tables).
- **Deferred:** the review double-answer guard (reject an answer once the card's `reps` has moved on).
- **Ideas backlog:** `docs/future-ideas.md`.

## Environment and Oracle

- Never assume where `.env` points, and never change it. Only the user does. Ask when it matters.
- Oracle changes always need the user's explicit approval, every time.
- **Pending Oracle steps:** none known as of this seed.
