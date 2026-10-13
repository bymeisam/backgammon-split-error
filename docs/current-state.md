# Current state

Start each new session here. `PROGRESS.md` is the history log: grep it only when you need the history behind something. `/wrap-up` rewrites this file at the end of each batch of work. Keep it under about a page: it's a snapshot, not history.

_Last updated: 2026-10-14._

## Code
- Branch `omp/main`. It is clean at `304228f` after the final review refinement (`ec30993`) and handoff verification (`304228f`); the app-write merge remains `d6c146e`.
- **The queued review refinement is complete and ready for main review.** It preserves master's app-wide `prismaApp` / `isAppWriteEnabled()` merge.
- **Local verification:** vitest 791/791, tsc, eslint, build and visual suite 15/15 are clean. The real local app returned HTTP 200 for `/api/review/queue`; no environment files were changed.
- **Screenshots:** final real-app captures are in `design/screenshots/2026-10-14-review-refinement-4/` and `-5/` at 390/1280 light/dark. Main-session image review found no visible Must/Should defects; the delegated visual-reviewer did not return a report. Representatives are listed in `docs/omp-queue.md`.
- **Seeded local proposal rows remain:** post 5 / StudyPosition 6 has replies 8 and 9 with Proposal IDs 1 and 2; post 7 / StudyPosition 8 has reply 10 with Proposal ID 3. No schema or migration changes.
- **Queue:** master lists the review notes on `8f8fd4b`; this branch has completed them and recorded the handoff under `Ready for review` in `docs/omp-queue.md`.
- The user kept omp's proposal design: a second board inside the reply form.

## Open threads

- **Claude Code, next batch: Phase 3** (plan in `~/.claude/plans/with-regards-to-auth-concurrent-comet.md`): the app-scoped Oracle user, `prismaApp`, `isAppWriteEnabled()`, then the Oracle migrations and Vercel env vars, followed by the user's push.
- **User:** tell Claude Code when omp marks `304228f` ready for review; main must review the branch before merging. The checks the user wanted to do remain.
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
- **Pending Oracle steps (all Phase 3, none run):**
  - the forum, role, `hideAnalysis` and move-proposal migrations, via `npx prisma migrate status` then `npx prisma migrate deploy`;
  - run `scripts/sql/app-db-user.sql` as the HeatWave admin with a real password;
  - set `DATABASE_URL_APP` on Vercel Production and Preview, and remove any `DATABASE_URL_AUTH` / `DATABASE_URL_FORUM` there;
  - set invited members' `AppUser.role = 'MEMBER'` by hand.
