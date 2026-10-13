# Current state

Start each new session here. `PROGRESS.md` is the history log: grep it only when you need the history behind something. `/wrap-up` rewrites this file at the end of each batch of work. Keep it under about a page: it's a snapshot, not history.

_Last updated: 2026-10-13._

## Code

- Branch `master`, clean. The last code commit is `c4efd77` (page guards on every page), on top of `dc690c6` (owner/member roles), followed by the wrap-up commit. **It's ahead of `origin/master` and not pushed** (about 63 commits). vitest 718/718, tsc, eslint, build and the visual suite are clean.
- **Don't push master until Phase 3 is done.** Pushing puts the Clerk wall and the role model on the live site. That needs the Clerk keys and `DATABASE_URL_AUTH` in Vercel, the forum and role migrations on Oracle, and the owner set up on Oracle (`AppUser.role = OWNER` plus Clerk `privateMetadata.isOwner`). Without them the site breaks or locks the user out.
- **Roles (Phase 2, done):**
  - Owner needs DB role `OWNER` **and** the Clerk flag. Member needs DB role `MEMBER` only. `NONE` waits on `/auth/complete`.
  - `lib/accessRules.ts` maps every page and API to its tier, and unlisted routes are owner. Every page and every API route calls its own guard, and tests enforce that.
  - Members never receive notes, tags or review data.
- **Local sign-in:**
  - `AUTH_BYPASS=true` skips sign-in, but only when every DB URL is localhost.
  - `AUTH_BYPASS_ROLE=member` shows the member view.
  - The developer's second server: `AUTH_BYPASS=true [AUTH_BYPASS_ROLE=member] ENABLE_WRITE_MODE=true NEXT_DIST_DIR=.next-test npx next dev -p 3300`.
  - Dev and build runs add `.next-*` lines to `tsconfig.json`. Revert them, and don't commit them.
- The old branches (`omp-forum`, `omp-position-builder`, `ollama-dev`, `shared-agents`) are merged and can be deleted when the user wants.

## Plan

The plan is in `~/.claude/plans/with-regards-to-auth-concurrent-comet.md`. Phases 0, 1 and 2 are done. Each later phase needs the user's approval before the developer starts it.
- **Phase 2b (next):** analysis on decision posts. The design was agreed with the user; see the plan's § Phase 2b. In short:
  - The poster's move is never shown.
  - The new-post form gets a "Permanently hide analysis" tick box.
  - Otherwise the post shows a "Show analysis" button, hidden by default.
  - First step: the investigator checks how a decision attachment is stored (`StudyPosition.sourceDecisionId`) and what `getDecisionAnalysis` returns for checker and cube decisions. Then a spec goes to the user for approval. It needs a designer pass, because it adds a new visible component.
- **Phase 3:** forum writes on the live site (a forum-scoped Oracle user, `prismaForum`, `isForumWriteEnabled()`), then the Vercel env vars, then the push.
- **Phase 4:** move proposals in replies.

## Open threads

- **Polish batch not seen in a browser:** the `--radius-inset` segmented controls, the shadow-free new-post preview board and the single-reply wording. Optional: a quick look by the designer.
- **Deferred design items (designer):** L2 (the board beside the discussion on post pages, which needs an answer for posts with several positions). Not yet in any screenshot: the delete modal, a selected stack taller than 5, a selected bar checker.
- **Designer:** look at the 2026-10-09 screenshots (`design/screenshots/2026-10-09-sources-fixes/`).
- **Needs the user's `.env`:** a 1024px navbar screenshot in the "Writes: Oracle · Reads: Local" state.
- **Ongoing:** move hand-composed buttons, tables and cards onto `app/components/ui/` whenever those files are touched.
- **Deferred:** the review double-answer guard. Ideas backlog: `docs/future-ideas.md`.
- **Accepted, not fixed:** paths containing a dot skip `proxy.ts`, so the layout's second-layer check can be fooled there. The page guards still apply.
- **Local test data:** forum posts 1–3 (smoke tests), 5 (decision 1149340) and 6 (built position), and a `local-dev-member` AppUser, are on the local DB only.

## Environment and Oracle

- Never assume where `.env` points, and never change it. Only the user does that.
- Oracle changes always need the user's explicit approval, every time.
- **Pending Oracle steps (none written up as commands yet; all part of Phase 3):**
  - the forum migrations and the role migration `20261013100000_app_user_role` (the owner row becomes OWNER from `isOwner`);
  - a forum DB user;
  - set invited members' `AppUser.role = 'MEMBER'` by hand.
