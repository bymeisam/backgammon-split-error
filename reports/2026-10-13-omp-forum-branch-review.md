# Review: `omp-forum` branch (2026-10-13)

Scope: 28 commits on `omp-forum` over master (`omp-position-builder` and `ollama-dev` are subsets of it). 77 files, +3550 / −295. It covers a Clerk auth wall, a forum (posts, replies, attached positions), a position builder, an interactive checker-move explorer, a GNU Position ID encoder, and omp agent config.

Checks run in a separate worktree: `prisma generate` passed, 580/580 vitest tests passed, eslint is clean. `tsc` reported one error, `LayoutProps` not found, which is a Next-generated type and expected in a fresh worktree with no `.next/`. Not run: `next build`, the app itself, the visual suite, and anything on Oracle.

Merge conflicts: only `PROGRESS.md`.

## Verdict

Don't merge as it stands. The position builder, the explorer and the encoder are worth keeping once the bugs are fixed. The auth wall and the forum are a separate product decision, and they need Oracle, Clerk and Vercel work before master can be pushed.

## Blockers

1. **Bear-off bug** (`lib/checkerMoves.ts`, `canBearOff`). The code never checks that every checker is home. Verified: with checkers on 13 and 3 and a die of 3, it offers `3/off`. The tests don't cover this.
2. **Replay regression** (`app/matches/[matchId]/replay/[gameIndex]/page.tsx`). The `GameSwitcher` was replaced by "Post to forum", so the replay can't switch games any more. The forum link also uses the server's `initialIndex`, not the decision on screen.
3. **Deploying is coupled to merging.** Once master is pushed, the live site needs Clerk keys, `DATABASE_URL_AUTH` (a new narrowly scoped Oracle DB user), both migrations on Oracle, and `AppUser.isOwner` plus the Clerk `privateMetadata.isOwner` set by hand. Without these, `clerkMiddleware` and the owner check will break the site or lock you out.
4. **`AGENTS.md` now carries omp runtime rules**, and `CLAUDE.md` imports `AGENTS.md`, so Claude sessions load them too. They conflict with `CLAUDE.md`: "read PROGRESS.md before meaningful work", "never use shell commands to mutate files", and the agent mapping to `scout`/`task`. Move them to an omp-only file (e.g. under `.omp/`).

## Significant

5. **The dev auth bypass is tied to `NODE_ENV=development`** (`lib/localAuthBypass.ts`). Every `next dev` run skips auth completely. If `.env` points at Oracle, a forum write upserts a `local-dev-owner` AppUser on Oracle and posts as that user. It should be an explicit opt-in flag, or removed.
6. **The code is out of style with the repo.** Forum routes and components are packed into one-liners (several statements per line, whole JSX forms on one line). `lib/gnuPositionId.test.ts` was squashed, lost its explanatory comments and dropped one test ("15 checkers after flipping"). Long explanatory comments were removed from `lib/prisma.ts`, `proxy.ts` and `app/layout.tsx`. `app/status/notes.ts` lost the read-only-deploy and navbar-badge notes.
7. **`ForumActions` reply edit** renders an `<input>` and a `<textarea>`, both bound to the reply body.
8. **Write buttons show in read-only mode** (New post, Edit, Delete, Reply). They just fail with a 403. The rest of the app hides write controls when writes are off.
9. **No designer review** of the new screens (forum list, post and new-post pages, position builder, sign-in, auth/complete, move explorer), which `CLAUDE.md` requires.
10. **Product fit.** For a one-user tool, the forum adds an AppUser table, a two-flag owner model and per-author ownership checks. `StudyPosition` also copies `positionId`/`gnuMatchId` for match-decision attachments, which the column rule would normally derive from `raw`.

## Good

- All 24 API routes call `requireOwnerApi`, and forum writes also respect `isGalaxyEnabled()`.
- The migrations pin `clerkUserId`, `positionId` and `gnuMatchId` to `utf8mb4_bin` with comments, and `docs/field-mapping.md` is updated.
- Post creation is transactional, and so are the cascades and the orphaned manual-position cleanup.
- Styles live in `.styles.ts` files and use the shared `Button`/`Card`/`PageShell`.
- Move generation otherwise handles max-dice, the larger-die rule, doubles, bar entry and hits. Encoder round-trips are tested.
