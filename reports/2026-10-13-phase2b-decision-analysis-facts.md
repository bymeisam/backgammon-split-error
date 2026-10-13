# Phase 2b facts: analysis on forum decision posts (2026-10-13)

From the investigator's report. The investigator worked from the code and the local DB only: Oracle and Galaxy were not checked. Saved by the main session, because the investigator has no write tool.

## 1. How a decision is attached
- `StudyPosition.sourceDecisionId` is an `Int?` with a real FK to `Decision` (`ON DELETE RESTRICT`).
  - Schema: `prisma/schema.prisma:438-443`.
  - Migration: `20261012100000_add_forum_study_positions`.
- `ForumPostPosition` (`schema.prisma:460-469`):
  - PK `(postId, studyPositionId)`, plus `displayOrder`.
  - It has no other columns, so there are no per-attachment flags.
- `ForumPost` (`:448-458`) has only title, body, timestamps and relations.
- Creating a post (`app/api/forum/posts/route.ts:105-141`) makes one new `StudyPosition` per attachment.
  - A `{match:{decisionId}}` attachment becomes `origin=MATCH_DECISION` with `sourceDecisionId` set.
  - A manual attachment becomes `origin=MANUAL` with `sourceDecisionId` null.
- A post holds 1 to `FORUM_LIMITS.positions` (4) positions, and decision-sourced and manual ones can be mixed.
- Replay's "Post to forum" (`GameReplay.tsx:211`) goes to `/forum/new?decision=<id>`, which prefills `NewPostForm` and then POSTs to `/api/forum/posts`.
- Local data:
  - Post 5 has one attachment: MATCH_DECISION, CHECKER, `sourceDecisionId=1149340`.
  - Posts 1 and 6 are MANUAL.
  - Posts 2 and 3 are MATCH_DECISION on decision 1257875, and post 3 has 2 attachments.

## 2. `getDecisionAnalysis` (`lib/analysis/index.ts:41`)
- Input is `{source: Match.source, raw: Decision.raw}` only. It needs no match, game or player perspective.
- It returns null for:
  - an unknown source;
  - a resignation;
  - an unreadable payload;
  - a checker decision without exactly one played candidate.
- **Checker** (`lib/analysis/types.ts:35-56`): `{kind:"checker", candidates}`.
  - Each candidate is `{move, rank, equity, loss, played, probs|null}`.
  - Candidates are sorted best first, so the best is `candidates[0]`.
  - **The played move is included (`played: true`).**
- **Cube** (`types.ts:58-70`): `{kind:"cube", role:"doubler"|"receiver", nd, dt, dp}`.
  - The equities are in the doubler's view.
  - The action labels come from `doublerAction` / `receiverAction` / `cubeBestDisplay` in `lib/cubeAction.ts`.
  - There is no played-action field. The played action comes separately, from `cubePlayedLabel` / `decisionLabels`.

## 3. Existing analysis UI
- The only renderer of ranked options and cube equities is inline in the card back of `app/review/ReviewSession.tsx`:
  - the options table is at about `:495-525`;
  - the cube cells are at `:526-545`.
- It is fed by `buildCardPayload` (which needs a ReviewCard) and is tied to quiz state ("Yours loses X", the played row). It can't be reused as it is.
- `MoveDelta.tsx`, `BoardPanel` and `MistakesSection` show the played move and the equity loss, so they are not suitable for a forum post.
- `CheckerMoveExplorer` is a plain move-making board, with no analysis.

## 4. Forum post page and editing
- `app/forum/[id]/page.tsx:27-135` is a server component.
  - It selects `sourceDecision: {id, game:{gameIndex, match:{sourceMatchId}}}` and does not select `raw` or `match.source`.
  - It renders `CheckerMoveExplorer` for checker positions and `Board` for cube positions.
- The new-post form is `app/forum/new/page.tsx` plus `NewPostForm.tsx`, posting to `POST /api/forum/posts`.
- Editing: `PATCH /api/forum/posts/[id]` takes `{title, body}` only. It is author-only (`canEditForumItem`) and needs the write gate. The UI is in `app/forum/[id]/ForumActions.tsx:65`.

## 5. Migrations
- The latest migration is `20261013100000_app_user_role`. No forum table has an analysis flag.
