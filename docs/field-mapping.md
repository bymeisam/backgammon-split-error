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
| `kind` | `CHECKER` for `"move"`, `CUBE` for `"cube_double"`/`"cube_pass"`, `RESIGNATION` for `"resignation"` — an exact mapping (`decisionKindFor` in `lib/ingest.ts`), never a fallback/else. Any other `analysed_event` is logged as a warning and skipped rather than guessed (see "Unrecognized analysed_event" below). |
| `analysedEvent` | `review.result.analysed_event` verbatim (`"move"` / `"cube_double"` / `"cube_pass"` / `"resignation"`). |
| `countAsDecision` | `metadata.count_as_decision` |
| `rawError` | `error_analysis.raw_error`, unmodified (not absolute-valued — the app layer takes `Math.abs()` where it needs magnitude). **Nullable** — confirmed against real data (match `32699544`): some events have a non-null `error_analysis` (real `error_severity`/`is_blunder`/`luck` values) but a null `raw_error` — `analysis_level: 1`, `error_severity: "doubtful"`, `event_type: "dice_rolled"` paired with `analysed_event: "cube_double"` — a partial/low-confidence analysis that grades severity without computing an equity-error magnitude. `lib/mistakes.ts`'s `extractDecisions` excludes `rawError: null` decisions entirely from PR (both numerator and denominator) — same treatment as `count_as_decision: false` and an unrecognized `analysed_event` — rather than letting `Math.abs(null)` silently coerce to `0` and count an ungraded decision as a zero-error clean play. |
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
| `cubeOwnerUserId` | Not in the payload directly — computed at ingest by walking a game's cube-kind decisions in order: starts `null` (centered), and becomes the taking player's `user_id` after a `cube_pass` review with `take === true`. Reflects who owned the cube *entering* each decision, before that decision's own outcome is applied. `null` for `CHECKER` and `RESIGNATION` kind. |
| `notationPlayed` | For `CHECKER` kind: the candidate move with `move_played: true`. Null for `CUBE`/`RESIGNATION` kind. |
| `notationBest` | For `CHECKER` kind: the candidate move with `rank === 1` (falls back to the first move if none has rank 1). Null for `CUBE`/`RESIGNATION` kind. |
| `cubeDetail` | For `CUBE` kind only (`analysed_event` exactly `"cube_double"` or `"cube_pass"` — never a fallback/else): a human-readable summary built from `review.double`/`review.take` plus `cube_analysis.doublers_best_action`/`receivers_best_action`. Null for `CHECKER`/`RESIGNATION` kind. |
| `resignError` | For `RESIGNATION` kind: `result.result.resign_error`. Null otherwise. |
| `shouldResign` | For `RESIGNATION` kind: `result.result.should_resign`. Null otherwise. |
| `resignationType` | For `RESIGNATION` kind: `result.result.resignation_type` — **confirmed nullable even for `RESIGNATION` rows**, not just absent for other kinds (seen `null` on a real blunder-severity resignation, match `2856675` event `440889365`). Null for other kinds too. |
| `equityBefore` | For `RESIGNATION` kind: `result.result.equity_before` — same nullability note as `resignationType`. Null for other kinds too. |
| `equityAfter` | For `RESIGNATION` kind: `result.result.equity_after` — same nullability note as `resignationType`. Null for other kinds too. |
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

**Confirmed safe to skip when `error_analysis` is null** (checked in
context against real payloads, not assumed):
- `game_started` / `game_over` / `turn_forfeited` — never carry a
  meaningful review anyway (excluded earlier via `NON_DECISION_EVENT_TYPES`,
  before this check would even run).
- `double_rejected` — sits right after the doubler's own `double_requested`
  event (which *is* fully analyzed) and records the receiver's rejection.
  `double: null`, `take: false`, `error_analysis: null` — an outcome record,
  not an independent decision.
- `double_accepted` — **this one is not uniform, and an earlier version of
  this doc got it wrong by checking only one example.** Verified against a
  real point-match, it can carry the receiver's genuine, fully-analyzed
  take/pass decision (`analysed_event: "cube_pass"`, real `error_analysis`,
  including a real detected blunder in one case: `raw_error: -0.1129,
  error_severity: "blunder"`) — that case is *not* skipped, since
  `error_analysis` isn't null, and is ingested normally. But verified
  against real backfill data, `double_accepted` can *also* show up with
  `analysed_event: "cube_double"` and `error_analysis: null`, sitting right
  after its own `double_requested` event exactly like `double_rejected`
  does — a pure outcome record. The structural `error_analysis === null`
  check already handles both cases correctly without needing to know why
  Galaxy shapes it differently case to case; only the *null* case needed
  adding to this confirmed-safe list.

Any other `event_type` that ever hits this path is unconfirmed — it'll be
logged rather than silently trusted, and should only be added to the
confirmed-safe list above once its `error_analysis: null` case has actually
been checked in context against real data, the way the three above were.

### The `resignation` decision shape

`event_type: "resigned"` events carry `analysed_event: "resignation"` — a
fourth, structurally distinct result shape, confirmed against a real payload
(match `2856675`, event `440889365`): `result.result` has exactly
`metadata`/`equity`/`probabilities`/`error_analysis`/`resign_error`/
`should_resign`/`resignation_type`/`equity_before`/`equity_after` — no
`moves` key (like `move` events have) and no `cube_analysis` key (like
`cube_double`/`cube_pass` events have). Treating it as cube-shaped (the
original bug: any non-`"move"` event was assumed to be `CUBE` and
unconditionally read `cube_analysis`) crashed on `undefined.receivers_best_action`.
In that same real payload, `resignation_type`/`equity_before`/`equity_after`
were all present but `null` — confirmed genuinely nullable, not assumed
always-populated just because they're resignation-specific fields (only
`resign_error`/`should_resign` were non-null in the one case checked).

The general fields (`rawError`, `errorSeverity`, `isBlunder`, `luck`,
`luckMwc`, `equity`, `mwc`, `classification`, `matchScoreBlack`/`White`,
`crawfordState`, `timestamp`) come from `error_analysis`/`metadata`/
`probabilities`, same as every other kind — no special-casing needed there.
Only the cube-specific (`cubeDetail`) and resignation-specific
(`resignError`/`shouldResign`/`resignationType`/`equityBefore`/
`equityAfter`) fields are kind-gated.

**RESIGNATION decisions are excluded from checker/cube PR calculations.**
`lib/mistakes.ts`'s checker/cube PR buckets are built by filtering on
`kind === "checker"` / `kind === "cube"` — a `"resignation"`-kind decision
matches neither filter and is naturally excluded from both totals, the same
way checker and cube decisions already never blend into each other. This is
deliberate: a resignation decision (should I resign given the current
equity?) isn't directly comparable to either a checker-play or a cube
decision, so folding its error into one of those buckets would just pollute
the stat with an unrelated decision type.

### Unrecognized `analysed_event`

`lib/ingest.ts`'s `decisionKindFor` (and `lib/mistakes.ts`'s copy of the same
mapping) only recognizes the four confirmed shapes above (`move`,
`cube_double`, `cube_pass`, `resignation`) and returns `null` for anything
else — the caller then logs a warning (`console.warn` +
`IngestSummary.warnings`, same non-fatal treatment as the null-`error_analysis`
warnings) and skips the event, rather than guessing a kind the way the
original `analysed_event === "move" ? CHECKER : CUBE` fallback did. This
guard is permanent, not a one-off fix for `resignation` — the next
unrecognized `analysed_event` Galaxy introduces will surface the same way
instead of silently crashing or being miscounted.

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

## Debugging notes

**A misleading Prisma error message: "Argument `<relation>` is missing."**
Hit while diagnosing why `rawError` needed to become nullable (match
`32699544`, 53 failed events, `prisma.decision.upsert()`). `lib/ingest.ts`
writes `Decision` rows using the scalar `gameId` foreign key directly (never
a nested `game: { connect: ... } }`), which is normally valid and had worked
for every prior match. But when a *different* field in the same `create`/
`update` payload fails type validation first (here: passing `rawError: null`
for what was then a required `Float` column), Prisma's error reporter
doesn't clearly say which field actually failed — it falls back to
describing the *other* create-input variant (the "checked" one, which needs
a nested `game` relation instead of a scalar `gameId`) and reports that as
the problem, even though `gameId` was present and correct all along.

**Lesson: don't trust the literal error text for a nested Prisma
create/update failure — diff the actual payload against the schema
field-by-field instead.** The real cause here only became visible by
comparing the dumped `create` object (which Prisma does print in full) to
`schema.prisma` column-by-column and spotting the one field whose value
(`null`) didn't match its declared (non-nullable) type. If a future
`Argument \`X\` is missing` error shows up and `X` looks like it's obviously
present in the payload, suspect a different field's type mismatch first
rather than the field actually named in the message.

**A second, related lesson: a large `create`/`update` failure can crash the
whole sync run, not just the one decision.** `lib/ingest.ts`'s per-event
`try`/`catch` already caught this correctly and kept going — the actual
crash came from `lib/sync.ts` writing the resulting (~480KB, many events
joined together) error message into `Match.ingestError`, a MySQL `TEXT`
column capped at 64KB. That write itself threw, uncaught, and killed the
whole backfill. Fixed by bounding what goes to the console/DB (`lib/sync.ts`'s
`summarizeError`, ~500 chars, single line) while the full, untruncated
detail (stack trace included) always goes to `logs/sync-errors.log`
instead — and by wrapping the failure-handling writes themselves in their
own `try`/`catch`, so even a problem while *recording* a failure can't
propagate and take down the run.
