# Current state

Start each new session here. `PROGRESS.md` is the history log: grep it only when you need the history behind something. `/wrap-up` rewrites this file at the end of each batch of work. Keep it under about a page: it's a snapshot, not history.

_Last updated: 2026-10-14._

## Code

- Branch `master`, clean. **Pushed up to `517674d`**. Two doc-only commits are unpushed: `01b8035` (future ideas) and `d35b3f9` (PROGRESS). vitest 773/773, tsc, eslint and build are clean.
- **Write model** (`docs/deploy.md` § The two write gates; `docs/field-mapping.md` § Credential scoping):
  - **Three clients:** `prismaReadOnly` (`DATABASE_URL_READONLY`, `bg_db_ro`), `prismaApp` (`DATABASE_URL_APP`, `bg_db_app`; falls back to `DATABASE_URL` outside production) and `prisma` (`DATABASE_URL`, `bg_db_rw`, for sync, ingest and migrations, on your machine only).
  - **`isAppWriteEnabled()`** (`lib/appWriteGate.ts`) gates every in-app write: forum, notes, tags, review, plus AppUser provisioning, which doesn't check the gate. Notes, tags and review stay owner-only.
  - **`isGalaxyEnabled()`** is for Galaxy and sync only.
- **Roles:** Owner needs DB role `OWNER` **and** Clerk `privateMetadata.isOwner`. Member needs `MEMBER`. `NONE` waits on `/auth/complete`. `lib/accessRules.ts` maps every route; anything unlisted is owner-only.
- **Local:** `.env` is back on local. `AUTH_BYPASS=true [AUTH_BYPASS_ROLE=member]` works only with localhost URLs. Local migrations are hand-written from `prisma migrate diff` (leave out the known `StudyPosition.sourceDecision` FK drift, check for `DROP`), then applied with `migrate deploy`.

## Live site (Vercel + Oracle)

- **Oracle:** all 24 migrations are applied (verified). `bg_db_app` is created, and its grants match `scripts/sql/app-db-user.sql` (verified). `AppUser`, the forum tables, `DecisionNote`, `ReviewCard` and `ReviewLog` are all empty on Oracle.
- **Vercel:** `DATABASE_URL_APP` is set. `DATABASE_URL` and `ENABLE_WRITE_MODE` must stay unset there.
- **Clerk:** the production instance uses the `*.vercel.app` URL. Clerk accepted it and shows it verified. If sign-in breaks, suspect this first. The planned move to `backgammon.bymeisam.dev` is described in `docs/deploy.md` § Clerk domain; users don't carry over between instances.
- **Waiting on the user (step D):**
  1. Sign in on the live site. You should land on `/auth/complete`, because your `AppUser` row is created as `NONE`.
  2. Ask Claude Code for the one-line SQL (run in DBeaver as the admin, an Oracle write) that sets your row to `OWNER`.
  3. Set `privateMetadata.isOwner = true` on your user in Clerk.
  4. Then run "Auth verification" in `docs/deploy.md`, and check that notes, review and the forum write on the live site.
  5. Members later: invite them in Clerk, then set `role = 'MEMBER'` by hand.

## omp (`../backgammon-omp`, `omp/main` at `02831c2`, not merged)

- **Queue** (`docs/omp-queue.md` on master, read with `git show master:docs/omp-queue.md`):
  1. **Item 3 of "Review notes at `b657ca6`":** merge master and resolve the reply-route (and probably `app/review/page.tsx`) conflicts onto `prismaApp` / `isAppWriteEnabled()`. Its forum routes still use `isGalaxyEnabled()`, so it **can't merge into master until this is done**.
  2. **"Review notes at `02831c2`":**
     - the 390px checker chip overflow (must-fix) and six visual should-fixes;
     - the `ReplyComposer.tsx:39` comment that contradicts its code;
     - the reply route header, the review key-reference headers, and JSX formatting;
     - missing screenshots: selected cube option, focus rings, tallies at 390.
- Then Claude Code re-reviews (investigator + visual-reviewer) and the user merges. Expect a small conflict in `docs/omp-queue.md`.

## Open threads

- **Small follow-ups (developer, approved to run after Phase 3, which is now done):**
  - `formatEquity` uses a hyphen and no "+";
  - the `StudyPosition.sourceDecision` onDelete drift (schema SET NULL, DB RESTRICT);
  - PATCH `/api/forum/posts/[id]` throws on a `null` body;
  - `bg_test` isn't migrated;
  - the designer body still names `design/screenshots/<YYYY-MM-DD>/`;
  - `docs/field-mapping.md` says "these five columns" but lists eight.
- **Later, not approved:** rename `isGalaxyEnabled()` → `isSyncEnabled()`, once omp's branch is merged.
- **Local check, optional, the user runs it:** the "Vercel-like" run (Galaxy off, app writes on, member). The command is in this session's history: `DATABASE_URL_APP=<local> ENABLE_WRITE_MODE=false AUTH_BYPASS=true AUTH_BYPASS_ROLE=member NEXT_DIST_DIR=.next-test npx next dev -p 3300`.
- **Question for the user:** are your existing notes and review cards in the local DB? Oracle has none. If they're local, they'll need copying to Oracle.
- **Ideas parked** (`docs/future-ideas.md`):
  - per-user permissions with an admin page;
  - **Snaps** (a position from a photo): Gemini free tier first, starting with a 10-photo test. It's omp's area; queue it when the user says.
- **Designer, deferred:** L2 (the board beside the discussion on post pages), and the unscreenshotted states (the delete modal, a selected stack taller than 5, a selected bar checker).
- **Ongoing:** move hand-composed buttons, tables and cards onto `app/components/ui/` when you touch them.
- **Accepted, not fixed:** paths containing a dot skip `proxy.ts`; the page guards still apply.
- **Local test data:** forum posts 1–3, 5, 6 and 7; omp's proposal replies 8–10 (`ForumMoveProposal` 1–3); and the `local-dev-member` AppUser. All are on the local DB only.
- The old branches (`omp-forum`, `omp-position-builder`, `ollama-dev`, `shared-agents`) are merged and can be deleted when the user wants.

## Rules to remember

- Never assume where `.env` points, and never change it. Only the user does that.
- Every Oracle write needs the user's explicit approval, every time. That includes the step D role update.
