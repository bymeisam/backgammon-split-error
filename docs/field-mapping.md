# Field mapping

> **Keep this doc in sync with `lib/ingest.ts`.** If you change how a field is
> derived there, update the corresponding row here in the same change.

This documents where every column in `Match`, `Game`, `Decision`, and
`PlayerIdentity` comes from — which upstream API response field it's read
from, and any computation applied. `raw` on `Decision` is the exception: it's
the complete original event object, not a derived field, so nothing needs
mapping for it beyond "store it as-is."

## Match

Sourced from `analyses/list/{page}`'s per-match `MatchAnalysis` rows
(`opponentName`/etc.), plus aggregated at the end of ingest from that match's
own decisions/games (`matchLength`, `playedAt`).

| Column | Origin |
|---|---|
| `id` | Internal auto-increment key — **not** a platform match ID. |
| `source` | Hardcoded per ingest module (`"galaxy"` in `lib/ingest.ts`) — identifies which platform this row came from. |
| `sourceMatchId` | The platform's own match ID, as a string (`String(matchId)` in `ingestMatch`). Combined with `source`, this is the real natural key — routes resolve a Match by `(source, sourceMatchId)`, never by `id` directly. |
| `opponentName` | `MatchAnalysis.opponentName` |
| `opponentCountry` | `MatchAnalysis.opponentCountry` |
| `opponentRating` | `MatchAnalysis.opponentRating` |
| `opponentError` | `MatchAnalysis.opponentError` |
| `opponentScore` | `MatchAnalysis.opponentScore` |
| `userError` | `MatchAnalysis.userError` |
| `userRating` | `MatchAnalysis.userRating` |
| `userScore` | `MatchAnalysis.userScore` |
| `matchLength` | `metadata.match_length` from any decision in the match (constant across the match; last one seen wins). Null until the match has been detail-ingested. |
| `playedAt` | `min(Game.playedAt)` across the match's games, set once detail ingest completes. Null until then — distinct from `createdAt`. |
| `createdAt` | DB default (`now()`), set when the row is first created — i.e. when the match was first ingested, not when it was played. |

## Game

| Column | Origin |
|---|---|
| `id` | Internal auto-increment key. |
| `matchId` | FK to `Match.id` (the internal key, not `sourceMatchId`). |
| `gameIndex` | The loop index used to fetch `game_reviews/{matchId}/{gameIndex}` (starts at 1). |
| `playedAt` | `min(timestamp)` across that game's decisions, i.e. `metadata.timestamp` of the earliest one. Null until detail-ingested. |

## Decision

One row per event in a game's `events` array that has a non-empty
`reviews[0]` — `game_started`/`game_over`/`turn_forfeited` events are
excluded explicitly (they're never decisions). Rows are stored regardless of
`countAsDecision`'s value; filtering by it happens at read time
(`lib/mistakes.ts`'s `extractDecisions`), not at ingest.

| Column | Origin |
|---|---|
| `id` | Internal auto-increment key. |
| `gameId` | FK to `Game.id`. |
| `eventId` | `event.id` (the original event's id from the payload), as `BigInt`. Unique per `(gameId, eventId)` — this is what makes re-sync idempotent. |
| `userId` | `event.user_id` — whichever player made this decision, not necessarily "you". |
| `color` | `event.color` |
| `kind` | `CHECKER` if `review.result.analysed_event === "move"`, else `CUBE`. |
| `analysedEvent` | `review.result.analysed_event` verbatim (`"move"` / `"cube_double"` / `"cube_pass"`). |
| `countAsDecision` | `metadata.count_as_decision` |
| `rawError` | `error_analysis.raw_error`, unmodified (not absolute-valued — the app layer takes `Math.abs()` where it needs magnitude). |
| `errorSeverity` | `error_analysis.error_severity`, mapped from the payload's lowercase string to the `NONE`/`DOUBTFUL`/`ERROR`/`BLUNDER` enum. |
| `isBlunder` | `error_analysis.is_blunder` |
| `luck` | `error_analysis.luck` |
| `luckMwc` | `error_analysis.luck_mwc` |
| `equity` | `result.result.equity` (the decision-level equity, not a per-candidate-move one). |
| `mwc` | `probabilities.mwc`, but only when `probabilities.mwc_context` is non-null — forced to `null` otherwise. |
| `classification` | **`review.source_position.classification` only — never `destination_position`.** The analysis is about the quality of a decision made *at* a position, so the phase that matters is the board state before the move (source), not after (destination); falling back to destination would silently mislabel the decision's phase. If `source_position`/`.classification` is ever actually missing, ingest throws for that one decision (caught, recorded in the ingest summary's `errors`) rather than silently substituting destination. |
| `matchScoreBlack` | `metadata.scores.black` |
| `matchScoreWhite` | `metadata.scores.white` |
| `crawfordState` | `metadata.crawford_state` |
| `cubeOwnerUserId` | Not in the payload directly — computed at ingest by walking a game's cube-kind decisions in order: starts `null` (centered), and becomes the taking player's `user_id` after a `cube_pass` review with `take === true`. Reflects who owned the cube *entering* each decision, before that decision's own outcome is applied. Always `null` for `CHECKER` kind. |
| `notationPlayed` | For `CHECKER` kind: the candidate move with `move_played: true`. Null for `CUBE` kind. |
| `notationBest` | For `CHECKER` kind: the candidate move with `rank === 1` (falls back to the first move if none has rank 1). Null for `CUBE` kind. |
| `cubeDetail` | For `CUBE` kind: a human-readable summary built from `review.double`/`review.take` plus `cube_analysis.doublers_best_action`/`receivers_best_action`. Null for `CHECKER` kind. |
| `timestamp` | `metadata.timestamp` |
| `myTag` | No source field yet — always `null`. |
| `raw` | The complete original `event` object (not just `reviews[0]`) — the zero-blind-spot archive `getGameReviews` reconstructs a game's events array from. |

## PlayerIdentity

Populated as a side effect of the `analyses/list` fetch (already called by
`/galaxy/matches`) — no dedicated endpoint, no token decoding.

| Column | Origin |
|---|---|
| `id` | Internal auto-increment key. |
| `source` | Hardcoded `"galaxy"` (same convention as `Match.source`). |
| `sourceUserId` | `AnalysesListResponse.userId` — the authenticated user's own platform ID (not per-match; this is who's asking, from the top level of the response). |
| `displayName` | `AnalysesListResponse.userName` |
| `isMe` | Defaults `true` — every row populated this way is, by construction, about whoever's token was used to fetch the list. |

Used anywhere the UI needs to show a name instead of a raw `userId`, or
decide "which side is you" in a match's decisions — `MistakesSection`
resolves this by matching a `userId` actually present in the match against a
`PlayerIdentity` row with `isMe: true`, rather than asking the viewer to pick
manually.
