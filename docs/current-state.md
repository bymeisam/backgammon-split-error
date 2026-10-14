# Current state

Start each new session here. `PROGRESS.md` is the history log: grep it only when you need the history behind something. `/wrap-up` rewrites this file at the end of each batch of work. Keep it under about a page: it's a snapshot, not history.

_Last updated: 2026-10-14._

## Code

- Branch `master`, clean. `origin/master` is at `204f8ab` (pushed: the omp merges, Clerk paths in code, queue hook, single-owner rule). One local commit not pushed: `3711702` (omp queue docs only). On the merged tree: vitest 792/792, tsc, eslint and build are clean.
- **Write model:** three clients, `prismaReadOnly` (`bg_db_ro`), `prismaApp` (`bg_db_app`, every in-app write) and `prisma` (`bg_db_rw`, local only, for sync, ingest and migrations). `isAppWriteEnabled()` gates app writes, and `isGalaxyEnabled()` is for Galaxy and sync only (`docs/deploy.md` § The two write gates).
- **Roles:** owner needs DB `role = 'OWNER'` **and** Clerk `privateMetadata.isOwner = true`. Member needs `MEMBER`. `NONE` waits on `/auth/complete`. **At most one OWNER row**, enforced by the generated `AppUser.ownerSlot` plus a unique index; demote the old row first if the owner's Clerk id changes. The local `AUTH_BYPASS` owner row (`local-dev-owner`) is stored as `NONE` and acts as owner in memory.
- **Clerk paths** are set in code (`lib/clerkConfig.ts`). Vercel needs only the two Clerk keys.
- **Local:** `.env` currently points at **Oracle** (`DATABASE_URL_READONLY` at least, per the user). Never assume and never change it. Local migrations are hand-written from `prisma migrate diff --from-config-datasource`; leave out the known `StudyPosition.sourceDecision` FK drift, and check for `DROP`.
- **Queue hook:** `.claude/hooks/omp-queue-check.mjs` runs at session start and lists omp's "Done by omp (to check)" entries that master hasn't checked.

## Live site (Vercel + Oracle)

- **Oracle:** 25/25 migrations applied, including the single-owner one (verified read-only). `AppUser` has one row, the owner (`OWNER`). Match 4,375 and Decision 1,266,751. The forum tables, `DecisionNote`, `ReviewCard` and `ReviewLog` were empty at the last check.
- **Clerk:** the live site uses the **development instance** (`pk_test_`/`sk_test_`), because the production instance can't work on `*.vercel.app` (no Account Portal, no invitations). The move to `backgammon.bymeisam.dev` is in `docs/deploy.md` § Clerk domain; members get re-invited on the production instance.
- **Vercel:** `DATABASE_URL_APP` and the Clerk test keys are set. `DATABASE_URL` and `ENABLE_WRITE_MODE` stay unset. **Deployment Protection is on** on purpose until launch (`docs/deploy.md` § Manual steps, step 6).
- **No Oracle steps are pending.**

## Open threads

- **User:**
  - push `3711702` when convenient (docs only); confirm that signed-out `/` lands on `/sign-in` on the vercel.app host and that the owner sees everything;
  - run "Auth verification" (`docs/deploy.md`) and check that notes, review and the forum write live;
  - invite members in the Clerk dev instance, then set their `AppUser.role = 'MEMBER'` on Oracle (an Oracle write, so ask for the SQL);
  - decide whether your existing notes and review cards live in the local DB. Oracle has none, so they'd need copying.
- **omp:** nothing queued. The `0c8ed7a` polish (`4a3c39f`) is checked and in master; the review-refinement thread is closed.
- **Small follow-ups (developer, approved earlier, not done yet):**
  - `formatEquity` uses a hyphen and no "+";
  - the `StudyPosition.sourceDecision` onDelete drift;
  - PATCH `/api/forum/posts/[id]` throws on a `null` body;
  - `bg_test` isn't migrated;
  - the designer body still names `design/screenshots/<YYYY-MM-DD>/`;
  - `docs/field-mapping.md` says "five columns" but lists eight;
  - optional: mention the single-owner rule in `app/status/notes.ts`.
- **Later, not approved:** rename `isGalaxyEnabled()` → `isSyncEnabled()`; the move to the custom domain.
- **Ideas parked** (`docs/future-ideas.md`): per-user permissions with an admin page; Snaps (a position from a photo, Gemini free tier first, omp's area).
- **Designer, deferred:** L2 (the board beside the discussion on post pages), and the unscreenshotted states (the delete modal, a selected stack taller than 5, a selected bar checker).
- **Local test data (local DB only):** forum posts 1–3 and 5–7; proposal replies 8–10 (`ForumMoveProposal` 1–3); AppUsers 1 (owner), 2 (`local-dev-owner`, NONE) and 3 (`local-dev-member`).

## Rules to remember

- Never assume where `.env` points, and never change it. Only the user does that.
- Every Oracle write needs the user's explicit approval, every time, including role updates.
