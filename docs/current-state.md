# Current state

Start each new session here. `PROGRESS.md` is the history log: grep it only when you need the history behind something. `/wrap-up` rewrites this file at the end of each batch of work. Keep it under about a page: it's a snapshot, not history.

_Last updated: 2026-10-14._

## Code

- Branch `omp/main`, clean through `b332f99` (forum board-handoff follow-ups; implementation `fafd8c4`). Vitest 816/816, tsc, lint, build and visual suite 21/21 are reported clean. The requested authenticated forum screenshots are present under `design/screenshots/2026-10-14-forum-text-posts/`; representative 390/1280 light/dark shots were inspected in this session.
- **Write model:** `prismaReadOnly` (`bg_db_ro`), `prismaApp` (`bg_db_app`, every in-app write), `prisma` (`bg_db_rw`, local only: sync, ingest, migrations). `isAppWriteEnabled()` gates app writes; `isGalaxyEnabled()` is Galaxy and sync only (`docs/deploy.md` § The two write gates).
- **Roles:** sign-up is invite-only in Clerk, so the invitation is the approval: new `AppUser` rows are created as **`MEMBER`** (`NEW_APP_USER_ROLE`, `lib/appRole.ts`); the schema default stays `NONE`. `NONE` means access removed by hand and lands on `/auth/complete` ("Access not active"). Owner needs DB `OWNER` **and** Clerk `privateMetadata.isOwner`; at most one OWNER row (`AppUser.ownerSlot` + unique index). Before public sign-up is ever opened, build the admin/approvals page first (`docs/future-ideas.md` § Per-user permissions).
- **Local:** `.env` was pointed at the **local DB** by the user during this batch. Never assume and never change it. `prisma migrate diff` against local is now empty (the `StudyPosition.sourceDecision` drift is fixed in the schema). Check every hand-written migration for `DROP`.

## Live site (Vercel + Oracle)

- **Oracle:** 25/25 migrations; nothing in this batch needs an Oracle step (the role default is code, the FK change is schema-only). One `AppUser` row, the owner.
- **Clerk:** the development instance (`pk_test_`/`sk_test_`) on `*.vercel.app`; the move to `backgammon.bymeisam.dev` is in `docs/deploy.md` § Clerk domain.
- **Vercel:** `DATABASE_URL_APP` and the Clerk test keys set; Deployment Protection on until launch (`docs/deploy.md` § Manual steps, step 6).
- **No Oracle steps are pending.**

## Open threads

- **User:**
  - migrate `bg_test` (its URL is only in `.env.test`): `! DATABASE_URL="$(grep '^DATABASE_URL=' .env.test | cut -d= -f2- | tr -d '"')" npx prisma migrate deploy`, then the same with `migrate status`; this is separate from the local visual run.
  - choose the `/auth/complete` eyebrow, still "Private owner access": change to "Game Review" (recommended) or remove;
  - check Clerk sign-up is restricted to invitations (the MEMBER default relies on it);
  - push; run "Auth verification" (`docs/deploy.md`) and check notes, review and the forum write live;
  - invite members in the Clerk dev instance (no SQL needed now, once pushed).
- Forum board-handoff follow-ups are complete on `omp/main` (`fafd8c4`, docs `b332f99`): handoffs are consumed once, the shared button is under `app/components/ui/`, captions are restored with a safe fallback, requested tests and screenshots are recorded in the queue. No schema, migration, Oracle, or `.env*` changes. Master review/merge remains.
- **Later, not approved:** rename `isGalaxyEnabled()` → `isSyncEnabled()`; the custom-domain move.
- **Ideas parked** (`docs/future-ideas.md`): forum topics and pinning (§ Forum); per-user permissions and an admin page; Snaps.
- **Designer, deferred:** L2 (board beside the discussion on post pages); unscreenshotted states (delete modal, selected stack > 5, selected bar checker).
- **Local test data (local DB only):** forum posts 1–3 and 5–7; proposal replies 8–10; AppUsers 1 (owner), 2 (`local-dev-owner`, NONE) and 3 (`local-dev-member`).

## Rules to remember

- Never assume where `.env` points, and never change it. Only the user does that.
- Every Oracle write needs the user's explicit approval, every time.
