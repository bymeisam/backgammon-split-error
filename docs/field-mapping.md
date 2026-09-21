# Field mapping

> **Keep this doc in sync with `lib/ingest.ts`.** If you change how a field is
> derived there, update the corresponding row here in the same change.

This documents where every column in `Match`, `Game`, `Decision`, and
`PlayerIdentity` comes from — which upstream API response field it's read
from, and any computation applied. `raw` on `Decision` is the exception: it's
the complete original event object, not a derived field, so nothing needs
mapping for it beyond "store it as-is."

## Collation for externally-sourced identifiers

Any column storing an externally-sourced string identifier (a Galaxy user
ID, match ID, or similar from any future source) must use a case-sensitive/
binary collation, not the engine default — MySQL's default collation is
case-insensitive, which could silently merge two distinct external IDs that
differ only in case. This applies whether or not the column is part of a
unique constraint — even a plain `WHERE userId = ...` lookup is vulnerable
to a false match under a case-insensitive collation.

Columns currently pinned this way: `Match.sourceMatchId`,
`PlayerIdentity.sourceUserId`, `Decision.userId`, `Decision.cubeOwnerUserId`.

`Decision.eventId` is also an externally-sourced identifier (Galaxy's own
event ID), but it does not need a collation pin — collation only governs
string comparison, and `eventId` is stored as `BigInt`, a numeric type with
no case-sensitivity concept at all. It's listed here for completeness, so
its absence from the collation-pinned column list above isn't mistaken for
an oversight.

**Note on implementation:** Prisma's schema DSL does not expose a collation
attribute for MySQL (only for SQL Server via `@db.Collation`). These four
columns are pinned to `utf8mb4_bin` by hand-editing the generated migration
SQL directly (adding `COLLATE utf8mb4_bin` to each column's definition) —
this is not visible in `schema.prisma` itself, only in the migration file.
Because of this, the collation pin is not automatically preserved if these
columns are ever altered by a future Prisma migration — anyone changing one
of these columns must manually re-add the `COLLATE utf8mb4_bin` clause to
the new migration's SQL. See the comment in the relevant migration file for
the same warning.

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
excluded explicitly (they're never decisions), and any event whose
`error_analysis` is `null` is also skipped as a non-decision (see "Events
skipped via null error_analysis" below). Rows are stored regardless of
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
| `matchScoreBlack` | `metadata.scores?.black`, nullable. `metadata.scores` is `null` for money-game-type matches (confirmed against a real match: `scores: null` *and* `match_length: null` together, consistently across every decision in the match) — there's no running match score to report for a match that isn't played to a fixed length. Not a data quality issue, a real category of match the original schema didn't account for. |
| `matchScoreWhite` | `metadata.scores?.white`, nullable — same reasoning as `matchScoreBlack`. |
| `crawfordState` | `metadata.crawford_state`. **Investigated and confirmed non-nullable** — even for money-game-type matches (where `scores`/`match_length` are null), `crawford_state` is still always a real string (`"none"` in every case checked, since the Crawford rule doesn't apply outside match play, but it's reported as a normal value rather than omitted). Recorded here so this isn't re-investigated later. |
| `cubeOwnerUserId` | Not in the payload directly — computed at ingest by walking a game's cube-kind decisions in order: starts `null` (centered), and becomes the taking player's `user_id` after a `cube_pass` review with `take === true`. Reflects who owned the cube *entering* each decision, before that decision's own outcome is applied. Always `null` for `CHECKER` kind. |
| `notationPlayed` | For `CHECKER` kind: the candidate move with `move_played: true`. Null for `CUBE` kind. |
| `notationBest` | For `CHECKER` kind: the candidate move with `rank === 1` (falls back to the first move if none has rank 1). Null for `CUBE` kind. |
| `cubeDetail` | For `CUBE` kind: a human-readable summary built from `review.double`/`review.take` plus `cube_analysis.doublers_best_action`/`receivers_best_action`. Null for `CHECKER` kind. |
| `timestamp` | `metadata.timestamp` |
| `myTag` | No source field yet — always `null`. |
| `raw` | The complete original `event` object (not just `reviews[0]`) — the zero-blind-spot archive `getGameReviews` reconstructs a game's events array from. |

### Events skipped via null `error_analysis`

Some events carry a `reviews[0]` but `error_analysis: null` inside it — an
outcome-logging event with nothing to grade, not a real decision. Rather
than key this off `event_type` (a specific string that might not cover
every case), `lib/ingest.ts` checks the structural signal directly: if
`error_analysis === null`, the event is skipped as a non-decision, the same
treatment `game_started`/`game_over`/`turn_forfeited` already get.

Because this check can't know in advance which `event_type`s legitimately
have this shape, it cross-checks against a small confirmed-safe list
(`EVENT_TYPES_SAFE_FOR_NULL_ERROR_ANALYSIS` in `lib/ingest.ts`). A skip for
a type on the list is silent; a skip for anything else is logged loudly
(`console.warn` + appended to `IngestSummary.warnings`, which does **not**
count against the match's success the way `IngestSummary.errors` does) —
so a genuinely new/unexpected shape doesn't silently slip through unnoticed
forever.

**Confirmed safe** (real `error_analysis: null`, verified against real
payloads, not assumed):
- `game_started` / `game_over` / `turn_forfeited` — never carry a
  meaningful review anyway (excluded earlier via `NON_DECISION_EVENT_TYPES`,
  before this check would even run).
- `double_rejected` — sits right after the doubler's own `double_requested`
  event (which *is* fully analyzed) and records the receiver's rejection.
  `double: null`, `take: false`, `error_analysis: null` — an outcome record,
  not an independent decision.

**Confirmed NOT to have this shape** (has real, populated `error_analysis`
— genuinely a decision, correctly left off the skip list):
- `double_accepted` — verified against a real point-match: `analysed_event:
  "cube_pass"`, `take: true`, and a fully-populated `error_analysis`
  (including a real detected blunder in one case: `raw_error: -0.1129,
  error_severity: "blunder"`). This is the receiver's genuine take/pass
  decision and must be ingested normally.

Any other `event_type` that ever hits this path is unconfirmed — it'll be
logged rather than silently trusted, and should only be added to the
confirmed-safe list above once its `error_analysis: null` shape has
actually been verified against real data, the same way `double_rejected`
was here.

**Deliberately not added:** a `Match.isMoneyGame` (or similar) categorical
flag. The evidence for "money game" is indirect — absence of
`match_length`/`scores`, plus an unusual `analysis_level: 998` seen on one
event — not a field Galaxy explicitly labels a match with. Encoding that
inference as a confidently-named boolean would overstate certainty that
doesn't actually exist. The nullable fields themselves (`Match.matchLength
IS NULL`, `Decision.matchScoreBlack/White IS NULL`) are the honest, directly
-true signal for now; a real category flag can be added later if Galaxy's
data ever confirms this more directly.

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
