# Current state

Start each new session here. `PROGRESS.md` is the history log: grep it only when you need the history behind something. `/wrap-up` rewrites this file at the end of each batch of work. Keep it under about a page: it's a snapshot, not history.

_Last updated: 2026-10-13._

## Code

- Branch `master`. It is clean after the wrap-up commit. The last work commits are:
  - `df9d7b8`: the visual-reviewer restored;
  - `f98cc46`: the analysis panel polish;
  - `94cdb68`: Phase 2b.
- **It's ahead of `origin/master` and not pushed** (about 68 commits). vitest 741/741, tsc, eslint, build and the visual suite are clean.
- **Don't push master until Phase 3 is done.** Pushing puts the Clerk wall and the role model on the live site. That needs:
  - the Clerk keys and `DATABASE_URL_AUTH` in Vercel;
  - the forum, role and `hideAnalysis` migrations on Oracle;
  - the owner set up on Oracle (`AppUser.role = OWNER` plus Clerk `privateMetadata.isOwner`).

  Without them the site breaks or locks the user out.
- **Roles:**
  - Owner needs DB role `OWNER` **and** the Clerk flag. Member needs `MEMBER`. `NONE` waits on `/auth/complete`.
  - `lib/accessRules.ts` maps every page and API to its tier, and unlisted routes are owner.
  - Members never receive notes, tags or review data.
- **Forum analysis (Phase 2b, done):**
  - Decision posts show a collapsed "Show analysis" panel (`app/forum/[id]/DecisionAnalysisPanel.tsx`), built server-side by `lib/forumAnalysis.ts`, which strips everything about the played move.
  - `ForumPost.hideAnalysis` is set by the "Hide engine analysis" checkbox (new-post and edit forms).
  - Accepted: the played move is often the worst row once the analysis is revealed.
- **Agents:**
  - There are five shared roles in `agents/roles/` (investigator, developer, designer, architect, visual-reviewer), generated for Claude Code and omp by `npm run agents:sync`. The main session is the orchestrator (omp's `orch`).
  - After a visible UI change, the visual-reviewer checks the screenshots. The designer is for new pages or kinds of component, or a design direction.
  - Not yet confirmed: that omp loads `visual-reviewer` at runtime.
- **Local sign-in:**
  - `AUTH_BYPASS=true` works only with localhost DB URLs. `AUTH_BYPASS_ROLE=member` gives the member view.
  - The second server: `AUTH_BYPASS=true [AUTH_BYPASS_ROLE=member] ENABLE_WRITE_MODE=true NEXT_DIST_DIR=.next-test npx next dev -p 3300`.
  - Revert any `.next-*` lines it adds to `tsconfig.json`.
- **Local migrations:** `prisma migrate dev` fails (no shadow-DB rights). Hand-write the migration from `prisma migrate diff` and apply it with `migrate deploy`.

## Plan

The plan is in `~/.claude/plans/with-regards-to-auth-concurrent-comet.md`. Phases 0, 1, 2 and 2b are done.
- **Phase 3:**
  - forum writes on the live site (a forum-scoped Oracle user, `prismaForum`, `isForumWriteEnabled()`);
  - then the Vercel env vars;
  - then the push.
- **Phase 4:** move proposals in replies.

## Open threads

- **User:**
  - wants to do some checks next session;
  - **omp worktree decided:** `../backgammon-omp` on `omp/main`, port 3400, **sharing the local DB**. The rules are in AGENTS.md § Two worktrees, one local DB (only master changes `prisma/`, additive only, check migrations for `DROP`). Hand-offs go through `docs/omp-queue.md`. The user creates the worktree and its local-only `.env`. Next: design the Phase 4 schema and land it on master, then queue Phase 4's UI and logic for omp.
- **Small follow-ups (developer, not yet approved):**
  - `formatEquity` uses a hyphen and no "+" (shared with the review card);
  - `onDelete: Restrict` on `StudyPosition.sourceDecision` (the schema says SET NULL, the DB says RESTRICT, so `migrate diff` keeps proposing it);
  - PATCH `/api/forum/posts/[id]` throws on a `null` body;
  - `bg_test` isn't migrated;
  - the designer body still names `design/screenshots/<YYYY-MM-DD>/`.
- **Designer, deferred:**
  - L2 (the board beside the discussion on post pages);
  - unscreenshotted states (the delete modal, a selected stack taller than 5, a selected bar checker);
  - the 2026-10-09 screenshots.
- **Needs the user's `.env`:** a 1024px navbar screenshot in the "Writes: Oracle · Reads: Local" state.
- **Ongoing:** move hand-composed buttons, tables and cards onto `app/components/ui/` when touched.
- **Deferred:** the review double-answer guard. Ideas: `docs/future-ideas.md`.
- **Accepted, not fixed:** paths containing a dot skip `proxy.ts`. The page guards still apply.
- **Local test data:** forum posts 1–3, 5 (decision 1149340), 6 (built) and 7 (cube decision 1268278), and a `local-dev-member` AppUser, are on the local DB only.
- The old branches (`omp-forum`, `omp-position-builder`, `ollama-dev`, `shared-agents`) are merged and can be deleted when the user wants.

## Environment and Oracle

- Never assume where `.env` points, and never change it. Only the user does that.
- Oracle changes always need the user's explicit approval, every time.
- **Pending Oracle steps (all part of Phase 3, none run):**
  - the forum migrations, `20261013100000_app_user_role` (the owner row becomes OWNER) and `20261013120000_forum_post_hide_analysis`, via `npx prisma migrate status` then `npx prisma migrate deploy`;
  - a forum DB user;
  - set invited members' `AppUser.role = 'MEMBER'` by hand.
