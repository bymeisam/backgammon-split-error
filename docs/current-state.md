# Current state

Start each new session here. `PROGRESS.md` is the history log: grep it only when you need the history behind something. `/wrap-up` rewrites this file at the end of each batch of work. Keep it under about a page: it's a snapshot, not history.

_Last updated: 2026-10-13._

## Code

- Branch `master`. It is clean after the wrap-up commit. The last work commits are:
  - `2345b5c`: omp queue, the review notes on Phase 4 part 2 and the review second try;
  - `adf2cdf`: the Phase 4 schema (`ForumMoveProposal`, enum `ForumCubeAction`), local only;
  - `9e3f527`, `82dde64`: the shared-DB and omp rules.
- **It's ahead of `origin/master` and not pushed** (about 77 commits). vitest 741/741, tsc, eslint and build are clean on master.
- **Don't push master until Phase 3 is done.** Pushing puts the Clerk wall and the role model on the live site. That needs:
  - the Clerk keys and `DATABASE_URL_AUTH` in Vercel;
  - the forum, role, `hideAnalysis` and move-proposal migrations on Oracle;
  - the owner set up on Oracle (`AppUser.role = OWNER` plus Clerk `privateMetadata.isOwner`).

  Without them the site breaks or locks the user out.
- **Roles:** Owner needs DB role `OWNER` **and** the Clerk flag; Member needs `MEMBER`; `NONE` waits on `/auth/complete`. `lib/accessRules.ts` maps every page and API to its tier (unlisted = owner). Members never receive notes, tags or review data.
- **Local sign-in:** `AUTH_BYPASS=true` works only with localhost DB URLs (`AUTH_BYPASS_ROLE=member` for the member view). Test server: `AUTH_BYPASS=true [AUTH_BYPASS_ROLE=member] ENABLE_WRITE_MODE=true NEXT_DIST_DIR=.next-test npx next dev -p 3300`; revert any `.next-*` lines it adds to `tsconfig.json`.
- **Local migrations:** `prisma migrate dev` fails (no shadow-DB rights). Hand-write from `prisma migrate diff` (leave out the known `StudyPosition.sourceDecision` FK drift, check for `DROP`) and apply with `migrate deploy`.

## Two tools in parallel

- **omp** works in `../backgammon-omp` on `omp/main` (dev server on port 3400), **sharing the local DB** with master (port 3000). Rules: AGENTS.md § Two worktrees, one local DB. Only master changes `prisma/`; work is split by area (omp: forum features and the review screen; Claude Code: Phase 3/infra, data, schema, reviews of `omp/main`).
- **Queue:** `docs/omp-queue.md` on master; omp reads it with `git show master:docs/omp-queue.md`. The user relays "next task" to omp and "omp is ready" to Claude Code.
- **`omp/main` (at `b657ca6`, not merged)** has merged master and holds Phase 4 parts 1 and 2 plus the review second try.
  - Reviewed by Claude Code, with the investigator and the visual-reviewer: no logic defects; vitest 759/759, tsc and lint are clean.
  - **Not mergeable yet:** no screenshot shows the proposal UI or the review reason and retry states, and there's a list of code clean-ups.
- **omp's queue now:** one task, "Review notes on `omp/main` at `b657ca6`" in `docs/omp-queue.md`. It covers seeding test proposals locally, capturing and visually reviewing every new state, and the clean-ups. After that, Claude Code re-reviews and the user merges. Expect a small conflict in `docs/omp-queue.md` when merging.
- The user kept omp's proposal design: a second board inside the reply form.

## Open threads

- **Claude Code, next batch: Phase 3** (plan in `~/.claude/plans/with-regards-to-auth-concurrent-comet.md`): a forum-scoped Oracle user, `prismaForum`, `isForumWriteEnabled()`, then the Oracle steps below, then the Vercel env vars, then the user pushes.
- **User:** tell omp to pick up the review-notes task; tell Claude Code when omp marks it ready for re-review; the checks the user wanted to do.
- **Small follow-ups (developer, not yet approved):**
  - `formatEquity` uses a hyphen and no "+" (shared with the review card);
  - the `StudyPosition.sourceDecision` onDelete drift (schema SET NULL, DB RESTRICT);
  - PATCH `/api/forum/posts/[id]` throws on a `null` body;
  - `bg_test` isn't migrated;
  - the designer body still names `design/screenshots/<YYYY-MM-DD>/`;
  - `docs/field-mapping.md` says "these five columns", but the list has eight.
- **Designer, deferred:** L2 (the board beside the discussion on post pages); unscreenshotted states (the delete modal, a selected stack taller than 5, a selected bar checker); the 2026-10-09 screenshots.
- **Needs the user's `.env`:** a 1024px navbar screenshot in the "Writes: Oracle · Reads: Local" state.
- **Ongoing:** move hand-composed buttons, tables and cards onto `app/components/ui/` when touched.
- **Deferred:** the review double-answer guard (it interacts with the second-try flow, which saves once per card). Ideas: `docs/future-ideas.md`.
- **Accepted, not fixed:** paths containing a dot skip `proxy.ts`. The page guards still apply.
- **Local test data:** forum posts 1–3, 5 (decision 1149340), 6 (built) and 7 (cube decision 1268278), and a `local-dev-member` AppUser, are on the local DB only.
- The old branches (`omp-forum`, `omp-position-builder`, `ollama-dev`, `shared-agents`) are merged and can be deleted when the user wants.

## Environment and Oracle

- Never assume where `.env` points, and never change it. Only the user does that.
- Oracle changes always need the user's explicit approval, every time.
- **Pending Oracle steps (all part of Phase 3, none run):**
  - the forum migrations, `20261013100000_app_user_role` (the owner row becomes OWNER), `20261013120000_forum_post_hide_analysis` and `20261013140000_forum_move_proposal`, via `npx prisma migrate status` then `npx prisma migrate deploy`;
  - a forum DB user;
  - set invited members' `AppUser.role = 'MEMBER'` by hand.
