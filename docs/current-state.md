# Current state

Start each new session here. `PROGRESS.md` is the history log: grep it only when you need the history behind something. `/wrap-up` rewrites this file at the end of each batch of work. Keep it under about a page: it's a snapshot, not history.

_Last updated: 2026-10-13._

## Code

- Branch `master`. It's clean, but **it's ahead of `origin/master` and not pushed**. Since `5847c49`, it has the shared agent setup (`619a876`) and the merged `omp-forum` branch (`b97064c`): the forum, position builder, move explorer, GNU Position ID encoder and Clerk auth wall. On master, vitest 604/604, tsc and eslint are clean.
- **Don't push master until Phase 3 is done.** Pushing puts the Clerk wall on the live site, which then needs the Clerk keys and `DATABASE_URL_AUTH` in Vercel, the forum migrations on Oracle, and the owner flags set (`AppUser.isOwner` plus Clerk `privateMetadata.isOwner`). Without them the site breaks or locks the user out.
- The old branches (`omp-forum`, `omp-position-builder`, `ollama-dev`, `shared-agents`) are all merged now and can be deleted when the user wants.
- **Local sign-in:** `next dev` now requires sign-in. Setting `AUTH_BYPASS=true` in `.env` skips it, but only when every DB URL is localhost. Under `next start`, `DATABASE_URL_AUTH` must be set (on the command line is fine).

## Plan

The plan is in `~/.claude/plans/with-regards-to-auth-concurrent-comet.md`. Phases 0 and 1 are done. Each later phase needs the user's approval before the developer starts it.
- **Phase 2:** owner/member roles (`AppUser` role, `lib/accessRules.ts`, owner-only UI on shared pages). The user decides then whether members see the analysis (played vs best, equity loss) on posts made from a match decision.
- **Phase 3:** forum writes on the live site (a forum-scoped Oracle user, `prismaForum`, an `isForumWriteEnabled()` gate), then Vercel env vars, then the push.
- **Phase 4:** move proposals in replies.

## Open threads

- **Post-merge design fixes** (developer, after the user approves), from `reports/2026-10-13-forum-design-review.md`:
  - S1: match context and a link back to the game on decision posts.
  - S5: a Modal for Delete, and a quieter Delete button.
  - S6: a preview on the new-post page.
  - S9: the whole list row clickable.
  - From the "Re-check" section: a ring on the top checker instead of the focus stroke and the selected tint, and the Clerk footer styling.
  - The "Later" items.
- **Designer:** look at the 2026-10-09 screenshots (`design/screenshots/2026-10-09-sources-fixes/`).
- **Needs the user's `.env`:** a 1024px navbar screenshot in the "Writes: Oracle · Reads: Local" state.
- **Ongoing, no batch of its own:** move hand-composed buttons, tables and cards onto `app/components/ui/` whenever those files are touched.
- **Deferred:** the review double-answer guard. Ideas backlog: `docs/future-ideas.md`.
- **Local test data:** forum posts 1–3 (smoke tests), 5 and 6 are on the local DB only.

## Environment and Oracle

- Never assume where `.env` points, and never change it. Only the user does that.
- Oracle changes always need the user's explicit approval, every time.
- **Pending Oracle steps:** none prepared. Phase 3 will need the forum migrations, a new DB user and the owner flags on Oracle. None of it is written up as commands yet.
