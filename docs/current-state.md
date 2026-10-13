# Current state

Start each new session here. `PROGRESS.md` is the history log: grep it only when you need the history behind something. `/wrap-up` rewrites this file at the end of each batch of work. Keep it under about a page: it's a snapshot, not history.

_Last updated: 2026-10-13._

## Code

- Branch `master`, clean. The last commit is `22727e1`. **It's ahead of `origin/master` and not pushed.** Since `5847c49` it has the shared agent setup, the merged `omp-forum` branch (`b97064c`: forum, position builder, move explorer, GNU Position ID encoder, Clerk auth wall) and the post-merge forum design fixes (`6aad727` Phase A, `6f98c71` Phase B). vitest 614/614, tsc and eslint are clean.
- **Don't push master until Phase 3 is done.** Pushing puts the Clerk wall on the live site, which then needs the Clerk keys and `DATABASE_URL_AUTH` in Vercel, the forum migrations on Oracle, and the owner flags set (`AppUser.isOwner` plus Clerk `privateMetadata.isOwner`). Without them the site breaks or locks the user out.
- The old branches (`omp-forum`, `omp-position-builder`, `ollama-dev`, `shared-agents`) are merged and can be deleted when the user wants.
- **Local sign-in:** `next dev` requires sign-in. `AUTH_BYPASS=true` in `.env` skips it, but only when every DB URL is localhost. Under `next start`, `DATABASE_URL_AUTH` must be set (on the command line is fine). For screenshots the developer runs a second server on :3300 (`AUTH_BYPASS=true ENABLE_WRITE_MODE=true NEXT_DIST_DIR=.next-test npx next dev -p 3300`) so the user's :3000 server is left alone.

## Plan

The plan is in `~/.claude/plans/with-regards-to-auth-concurrent-comet.md`. Phases 0 and 1 are done. Each later phase needs the user's approval before the developer starts it.
- **Phase 2 (next):** owner/member roles (`AppUser` role, `lib/accessRules.ts`, owner-only UI on shared pages). The user decides then whether members see the analysis (played vs best, equity loss) on decision posts (design review item L1).
- **Phase 3:** forum writes on the live site (a forum-scoped Oracle user, `prismaForum`, an `isForumWriteEnabled()` gate), then Vercel env vars, then the push.
- **Phase 4:** move proposals in replies.

## Open threads

- **Forum polish, from the designer's Phase B re-check** (waiting on the user to approve, then developer). See `reports/2026-10-13-forum-design-review.md`, last section.
  - A `--radius-inset` (6px) token for the three segmented controls (position builder, Settings mode switch, TokenModal tabs), with `p-[3px]` tracks.
  - A calmer shadow on the new-post preview board only.
  - "Its reply goes with it." instead of "Its 1 reply goes with it."
- **Deferred design items:** L2 (board beside the discussion on post pages; needs an answer for posts with several positions). No screenshot yet of the delete modal, a selected stack taller than 5, or a selected bar checker.
- **Designer:** look at the 2026-10-09 screenshots (`design/screenshots/2026-10-09-sources-fixes/`).
- **Needs the user's `.env`:** a 1024px navbar screenshot in the "Writes: Oracle · Reads: Local" state.
- **Ongoing, no batch of its own:** move hand-composed buttons, tables and cards onto `app/components/ui/` whenever those files are touched.
- **Deferred:** the review double-answer guard. Ideas backlog: `docs/future-ideas.md`.
- **Local test data:** forum posts 1–3 (smoke tests), 5 (decision 1149340) and 6 (built position) are on the local DB only.

## Environment and Oracle

- Never assume where `.env` points, and never change it. Only the user does that.
- Oracle changes always need the user's explicit approval, every time.
- **Pending Oracle steps:** none prepared. Phase 3 will need the forum migrations, a new DB user and the owner flags on Oracle. None of it is written up as commands yet.
