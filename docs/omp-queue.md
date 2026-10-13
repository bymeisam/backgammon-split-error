# omp queue

Hand-offs between Claude Code (on `master`) and omp (on `omp/main` in `../backgammon-omp`). The rules are in AGENTS.md § Two worktrees, one local DB. Newest items at the top of each section. Mark an item done by moving it to "Done" with the date and commit.

## Tasks for omp

### Phase 4, part 2: proposal APIs and real data (queued 2026-10-13)
Start after part 1. **First merge `master` into `omp/main`, then run `npx prisma generate`**: master's `adf2cdf` added `ForumMoveProposal` and enum `ForumCubeAction` (see prisma/schema.prisma), and they're already applied to the shared local DB.
- The reply create API (`app/api/forum/posts/[id]/replies/route.ts`) and edit API (`app/api/forum/replies/[id]/route.ts`) accept `proposals: [{studyPositionId, resultPositionId} | {studyPositionId, cubeAction}]`.
- Validate with part 1's helpers: the position belongs to the post and its kind fits the proposal; checker results must be reachable through `legalSequences`, and the server stores its own notation; cube actions must be allowed by `doubleOffered`. At most one proposal per position per reply (the DB unique key enforces it too).
- A reply needs text **or** at least one proposal. Editing a reply replaces its proposals. Deleting a reply removes them (FK cascade).
- Load proposals with the post (`app/forum/[id]/page.tsx`) and wire part 1's UI to real data: the chips in replies and the collapsed "Show proposals (n)" tally per position.
- Checks: tests for the APIs, tsc, eslint, vitest, build; screenshots with `scripts/design-screenshots.ts` checked by the visual-reviewer. Then add an entry under "Ready for review".

### Phase 4, part 1: helpers and UI, no DB (in progress, started 2026-10-13)
Given to omp directly. In short: `lib/forumProposals.ts` (`validateCheckerProposal` with doubles expanded to four dice, `cubeActionsFor`, a tally helper); an optional `onChange` callback on `CheckerMoveExplorer`; the UI pieces (propose controls in the reply composer, cube buttons for CUBE positions, a proposal chip that opens the board after the play, a collapsed "Show proposals (n)" panel), built against typed props.

## Schema requests (omp → master)

_Use this shape:_
- **Date / task:** …
- **Change:** table or column, type, nullable/default
- **Why:** …
- **Schema rule met:** 1, 2 or 3 (AGENTS.md § Schema rule)

## Ready for review (omp → master)

_Branch `omp/main` at commit …, what was done, which checks ran._

## Done
