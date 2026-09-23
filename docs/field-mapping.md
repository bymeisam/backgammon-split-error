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

## Credential scoping

Two separate MySQL connection strings, each pointed at a user scoped to the
minimum privilege its callers actually need — introduced when the Oracle
HeatWave instance was set up with two real MySQL users:

- **`bg_readwrite`** — `SELECT`/`INSERT`/`UPDATE`/`DELETE`/`CREATE`/`ALTER`/
  `INDEX`/`REFERENCES` on the `backgammon` database. Used for ingest and
  schema migrations.
- **`bg_readonly`** — `SELECT` only on the `backgammon` database. Used for
  read-only access.

`lib/prisma.ts` exports one Prisma client per credential — `prisma` (reads
`DATABASE_URL`) and `prismaReadOnly` (reads `DATABASE_URL_READONLY`) — via a
shared client-construction helper, rather than each caller building its own
adapter. Locally both env vars point at the same single Docker MySQL user
(`app`) — there's no local privilege separation to test against — but the
split exists in the code regardless of environment, so production
(`bg_readwrite`/`bg_readonly`) is a config change, not a code change.

**Call sites, by actual need:**

| Client | Used by |
|---|---|
| `prisma` (read-write) | `lib/ingest.ts`, `lib/sync.ts`, `scripts/backfill.ts`, `scripts/incremental-sync.ts`, `scripts/runSyncCli.ts`, `/api/sync/incremental`, `app/api/galaxy/matches/list/[page]/route.ts` (writes the `isMe` `PlayerIdentity` row), `prisma/seed.ts`, `scripts/backfill-opponent-identities.ts` |
| `prismaReadOnly` (read-only) | `lib/local-client.ts` (the `/matches` DB-backed read path — and everything that routes through it: `/api/matches/list/[page]`, `/api/matches/[matchId]/[gameIndex]`), `app/api/player-identities/route.ts`, `app/status/page.tsx` |

**`prisma migrate deploy` itself is a separate concern from these two app
runtime clients.** It's configured in `prisma7.config.ts`, which reads
`DATABASE_URL` — the same var the read-write app client uses — and stays
there deliberately: schema changes need `CREATE`/`ALTER`/`INDEX`/
`REFERENCES`, privileges `bg_readwrite` already has but a narrower app-only
user wouldn't. Don't point migrations at `bg_readonly`, and don't invent a
third, even-more-privileged migration-only user unless `bg_readwrite`'s
grants ever turn out to be insufficient.

**One deliberately-flagged ambiguous case:** `scripts/backfill-opponent-identities.ts`
is named like the other "backfill" scripts, but unlike a pure diagnostic, it
*writes* — it upserts `PlayerIdentity` rows. It uses the read-write client,
not read-only, despite the naming similarity. The rule going forward: only
a script that **exclusively reads** (verification/diagnostic scripts) gets
the read-only client; anything that writes, even a one-time backfill, gets
read-write. `app/api/db-check/route.ts` is the one other place that reads
`DATABASE_URL` directly rather than either shared client — left as-is since
its specific job is verifying that exact connection string works (a
narrower purpose than a general read-only health check), not because it's
an oversight.

`allowPublicKeyRetrieval=true` and `ssl=true` (as query params on the
connection-string URL) are required for both `DATABASE_URL` and
`DATABASE_URL_READONLY` in production, connecting to Oracle HeatWave's NLB
public IP — see `.env.example` for the exact URL shape. Not needed locally
(plain Docker MySQL, no SSL).

**`ssl=true` alone is not enough** — the query param maps to boolean
`ssl: true`, which uses Node's default TLS verification (publicly-trusted
CAs only). Oracle HeatWave issues its own private CA for this DB endpoint
(`CN=MySQL_Endpoint_CA`, self-signed, not publicly trusted), so a bare
`ssl: true` connection fails with "self-signed certificate in certificate
chain" — surfaced by the `mariadb` driver as an opaque `pool timeout` rather
than a clear TLS error, since the underlying handshake failure isn't
propagated as an obvious error message. `lib/prisma.ts`'s
`buildConnectionConfig` (exported, reused by `app/status/page.tsx`'s
isolated client — see above) handles this: it parses the URL itself and,
when `ssl=true` is present, attaches `certs/oracle-mysql-ca.pem` (the CA
cert, fetched directly from the server's TLS handshake — safe to commit,
it's public) as `ssl.ca`. This is real chain-of-trust validation against
that specific CA, not disabled verification — a rogue/unsigned cert is
still rejected. One more wrinkle: the driver's TLS handshake code doesn't
forward `host` into the underlying `tls.connect()` call, and even if it
did, Oracle's cert has no SAN and its CN (`MySQL_Endpoint_Server`) isn't the
IP the app connects by — so hostname matching would fail regardless.
`buildConnectionConfig` also sets `ssl.checkServerIdentity: () => undefined`
to skip only that hostname check; chain validation against the pinned CA
still fully applies. Any new code that needs to connect to Oracle directly
(bypassing the shared `prisma`/`prismaReadOnly` clients) must go through
`buildConnectionConfig`, not construct `new PrismaMariaDb(url)` from a bare
URL string — `app/api/db-check/route.ts` and `prisma/seed.ts` are the two
exceptions, and both are intentionally local-only (see above / their own
header comments), never meant to run against Oracle.

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

**`count_as_decision: false` and `error_analysis: null` are independent
conditions — a row is normally still written for the former.** For most
events, `metadata.count_as_decision === false` (pre-roll cube checks,
forced-move cases with only one legal move, etc.) does **not** skip the
Decision row — `lib/ingest.ts` still writes it, with `countAsDecision: false`
stored and the real (non-null) grading fields populated, so a downstream
consumer that needs the complete event sequence (e.g. a game-replay
scrubber) can query `Game.decisions` unfiltered and see every event; only
`lib/mistakes.ts`'s PR calculation filters `countAsDecision: false` out, at
read time. It's only the *separate* `error_analysis === null` check above
that actually skips writing a row at all.

In theory these two conditions could both hold for the same event — a
`count_as_decision: false` event whose `error_analysis` also happens to be
`null` — which would mean it falls through the null-`error_analysis` skip
and gets no row, a gap a naive read of `countAsDecision: false` wouldn't
explain (it'd just look entirely absent, not "present but excluded").
Diagnosed for `double_rejected`/`double_accepted` specifically (the two
confirmed-safe types above) against the live backfill DB (984,552 Decision
rows at the time of checking): every stored row for both types —
2,206 `double_accepted` + 1,828 `double_rejected`, 4,034 combined — has
`countAsDecision: true`, zero have `false`. No variance found, and no
direct evidence (logs or data) that the combination has ever actually
dropped a row for these two types — consistent with (though not proof of,
since skipped rows leave no trace to query) the two event types cleanly
partitioning into a "real decision" instance (`error_analysis` populated,
`count_as_decision: true`) and an "outcome record" instance
(`error_analysis: null`, presumably `count_as_decision: false` too) — in
which case this isn't a second, independent gap on top of the
already-understood null-`error_analysis` skip, just the same skip
redundantly flagged. Left undocumented as a fix target — the existing
unrecognized-`event_type`/unconfirmed-null-`error_analysis` warnings remain
the real safety net for catching this (or any other event-type shape) if it
ever does turn out to drop a row that mattered.

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

Covers **both** you and your opponents — a lookup/reference table keyed by
`(source, sourceUserId)`, not a replacement for the raw `userId`/
`cubeOwnerUserId` string columns already on `Decision`, which stay exactly
as they are.

**`source` is what scopes a `sourceUserId`'s meaning, and it's mandatory on
every row — no exceptions.** A bare Galaxy user ID string (Mongo-style,
e.g. `"62febc99a2eb070024ace099"`) means nothing on its own; it's only ever
meaningful as "this ID, on this platform." `source` is hardcoded `"galaxy"`
everywhere a `PlayerIdentity` row gets created — `lib/ingest.ts`,
`lib/sync.ts`, and `app/api/galaxy/matches/list/[page]/route.ts` all use the
same `const SOURCE = "galaxy"` convention as `Match.source`. If a second
platform is ever added, its own ingest module gets its own `SOURCE`
constant (same pattern `Match`/`Decision` already follow) — never a shared
or null value.

| Column | Origin |
|---|---|
| `id` | Internal auto-increment key. |
| `source` | Hardcoded `"galaxy"` — see above. |
| `sourceUserId` | The platform's own user ID. For the `isMe: true` row: `AnalysesListResponse.userId` (the authenticated user's own ID, from the top level of the `analyses/list` response — not per-match). For opponent rows: `event.user_id` from a match's own event stream, for whichever `user_id` isn't the known `isMe: true` one. |
| `displayName` | For the `isMe: true` row: `AnalysesListResponse.userName`. For opponent rows: `Match.opponentName` from that opponent's **most recently played** match (`Match.playedAt`, falling back to `createdAt` if null) — an opponent's display name can change between matches, and picking arbitrarily (e.g. whichever match happened to be processed last) would silently pick an unpredictable one instead of a deliberate "most recent" choice. |
| `isMe` | `true` only for the authenticated user's own row. `false` for every opponent row — set explicitly on create, since the column's schema default is `true` and would otherwise mislabel an opponent. |

**Populated from three places, all using the same `(source, sourceUserId)`
upsert so re-running any of them is idempotent:**
- `app/api/galaxy/matches/list/[page]/route.ts` — upserts the `isMe: true`
  row on every list-page fetch (unchanged, original behavior).
- `lib/sync.ts`'s index-sync step — upserts the same `isMe: true` row on
  every `analyses/list` page walked during a sync run, so the CLI/script
  path (`scripts/backfill.ts`/`scripts/incremental-sync.ts`, which never hit
  the route above) also has "you" established before detail-ingest runs.
- `lib/ingest.ts`'s `ingestMatch` — after detail-ingesting a match, resolves
  the opponent's `user_id` from that match's own event stream (any `user_id`
  seen that isn't the already-known `isMe: true` one — a match is 1v1, so
  this is unambiguous) and upserts a `PlayerIdentity` row for them with
  `displayName: indexData.opponentName`, `isMe: false`. **Depends on the
  `isMe: true` row already existing** — if it doesn't yet (a fresh DB that's
  never synced or visited `/galaxy/matches`), `ingestMatch` can't tell "you"
  from "opponent" and simply skips opponent-identity population for that
  call, rather than risking misattributing your own `user_id` as an
  opponent's. Each individual `ingestMatch` call reflects only *that*
  match's own currently-known `opponentName` on upsert — unlike the one-time
  backfill script below, this isn't a full cross-match "most recent name"
  comparison, so a match re-synced out of chronological order could in
  theory regress a `displayName` a newer match already set. Accepted as a
  rare edge case (display-name changes are uncommon, and matches are
  normally processed roughly in order by the resumable sync loop).

**One-time backfill:** `scripts/backfill-opponent-identities.ts` populated
`PlayerIdentity` for every opponent already present in decisions ingested
before this feature existed (2,111 distinct opponents, from 8,464 distinct
`(matchId, userId)` pairs across 4,274 matches) — computing the
"most-recently-played match's name" per opponent exactly as described
above, across the whole dataset at once rather than one match at a time.
Safe to re-run (same upsert semantics as the three ongoing paths above).

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
