# Field mapping

> **Keep this doc in sync with `lib/ingest.ts`.** If you change how a field is
> derived there, update the corresponding row here in the same change.

This documents where every column in `Match`, `Game`, `Decision`, and
`PlayerIdentity` comes from — which upstream API response field it's read
from, and any computation applied. `raw` on `Decision` is the exception: it's
the complete original event object, not a derived field, so nothing needs
mapping for it beyond "store it as-is." Values the app shows but doesn't
store — derived from `raw` on demand — are listed under "Derived from raw"
below (since 2026-10-07, when the columns that duplicated them were
dropped: `reports/2026-10-07-column-audit.md`).

## Collation for externally-sourced identifiers

Any column storing an externally-sourced string identifier (a Galaxy user
ID, match ID, or similar from any future source) must use a case-sensitive/
binary collation, not the engine default — MySQL's default collation is
case-insensitive, which could silently merge two distinct external IDs that
differ only in case. This applies whether or not the column is part of a
unique constraint — even a plain `WHERE userId = ...` lookup is vulnerable
to a false match under a case-insensitive collation.

Columns currently pinned this way: `Match.sourceMatchId`,
`PlayerIdentity.sourceUserId`, `Decision.userId`,
`RepeatedPosition.sourcePositionId`, `Decision.sourcePositionId`.
(`Decision.cubeOwnerUserId` was pinned too until it was dropped on
2026-10-07; its pin went with it.)

`Decision.eventId` is also an externally-sourced identifier (Galaxy's own
event ID), but it does not need a collation pin — collation only governs
string comparison, and `eventId` is stored as `BigInt`, a numeric type with
no case-sensitivity concept at all. It's listed here for completeness, so
its absence from the collation-pinned column list above isn't mistaken for
an oversight.

**Note on implementation:** Prisma's schema DSL does not expose a collation
attribute for MySQL (only for SQL Server via `@db.Collation`). These five
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

- **`bg_db_rw`** — `SELECT`/`INSERT`/`UPDATE`/`DELETE`/`CREATE`/`ALTER`/
  `INDEX`/`REFERENCES` on the `backgammon` database. Used for ingest and
  schema migrations.
- **`bg_db_ro`** — `SELECT` only on the `backgammon` database. Used for
  read-only access.

`lib/prisma.ts` exports one Prisma client per credential — `prisma` (reads
`DATABASE_URL`) and `prismaReadOnly` (reads `DATABASE_URL_READONLY`) — via a
shared client-construction helper, rather than each caller building its own
adapter. The local Docker MySQL has the same two users
(`bg_db_rw`/`bg_db_ro`, same grant shapes, on `app_dev` and `bg_test`), and
the local `.env` uses them, so the split can be tested locally.
`.env.example` still defaults both vars to the docker-compose `app` user
for a fresh checkout. The split exists in the code regardless of
environment, so production (`bg_db_rw`/`bg_db_ro`) is a config change, not
a code change.

**Call sites, by actual need:**

| Client | Used by |
|---|---|
| `prisma` (read-write) | `lib/ingest.ts`, `lib/sync.ts`, `scripts/backfill.ts`, `scripts/incremental-sync.ts`, `scripts/runSyncCli.ts`, `/api/sync/incremental`, `app/api/galaxy/matches/list/[page]/route.ts` (writes the `isMe` `PlayerIdentity` row), `prisma/seed.ts`, `scripts/backfill-opponent-identities.ts`, `app/api/decisions/[id]/note/route.ts` (saves/clears a `DecisionNote`), `scripts/notes-import.ts`, the review and tag writes (`app/api/review/cards`, `app/api/review/cards/[id]`, `app/api/review/cards/[id]/answer`, `app/api/review/bulk`, `app/api/tags/attach`, `app/api/tags/detach`) |
| `prismaReadOnly` (read-only) | `app/api/review/queue`, `app/api/review/summary`, `app/api/tags` (GET), `app/review/page.tsx`, `app/review/cards/page.tsx`, `app/page.tsx` (the due count), `lib/local-client.ts` (the `/matches` DB-backed read path — and everything that routes through it: `/api/matches/list/[page]`, `/api/matches/[matchId]/[gameIndex]`), `app/api/player-identities/route.ts`, `app/status/page.tsx`, `app/api/decision-notes/route.ts` (`/matches/[matchId]`'s per-match note lookup; `/galaxy/matches/[matchId]` never calls it), `scripts/notes-export.ts` |

**`prisma migrate deploy` itself is a separate concern from these two app
runtime clients.** It's configured in `prisma7.config.ts`, which reads
`DATABASE_URL` — the same var the read-write app client uses — and stays
there deliberately: schema changes need `CREATE`/`ALTER`/`INDEX`/
`REFERENCES`, privileges `bg_db_rw` already has but a narrower app-only
user wouldn't. Don't point migrations at `bg_db_ro`, and don't invent a
third, even-more-privileged migration-only user unless `bg_db_rw`'s
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
(`opponentName`/etc.), plus `playedAt`, computed at the end of ingest from
that match's own decisions. The list fields come from Galaxy's list endpoint,
not from `raw`, and `/matches` shows them without loading any `raw`, so they
stay columns. The match length isn't stored: it's in every decision's own
GNU Match ID (see "Derived from raw").

| Column | Origin |
|---|---|
| `id` | Internal auto-increment key — **not** a platform match ID. |
| `source` | Hardcoded per ingest module (`"galaxy"` in `lib/ingest.ts`) — identifies which platform this row came from. Picks the reader for every decision's `raw` (`lib/analysis/index.ts`). |
| `sourceMatchId` | The platform's own match ID, as a string (`String(matchId)` in `ingestMatch`). Combined with `source`, this is the real natural key — routes resolve a Match by `(source, sourceMatchId)`, never by `id` directly. Also builds the "View on Galaxy" link (since 2026-10-07): `https://www.backgammongalaxy.com/play/page_analysis_match_details?match_id=<sourceMatchId>`, match-level only (Galaxy's review page has no game or move parameter). One helper, `lib/externalMatchUrl.ts`'s `externalMatchUrl(source, sourceMatchId)`, returns it only for `source === "galaxy"` and null for any other source, so a future XG import gets no link. Shown on `DecisionCard` (/mistakes, /repeated-positions), `/matches/[matchId]` and the replay; opens in a new tab (`rel="noopener noreferrer"`). |
| `opponentName` | `MatchAnalysis.opponentName` |
| `opponentCountry` | `MatchAnalysis.opponentCountry` |
| `opponentRating` | `MatchAnalysis.opponentRating` |
| `opponentError` | `MatchAnalysis.opponentError` |
| `opponentScore` | `MatchAnalysis.opponentScore` |
| `userError` | `MatchAnalysis.userError` |
| `userRating` | `MatchAnalysis.userRating` |
| `userScore` | `MatchAnalysis.userScore` |
| `playedAt` | `metadata.timestamp` of the first decision **by eventId** (not the earliest timestamp value) with a populated `error_analysis`, in the match's first game (lowest `gameIndex`) that has one. Computed in memory by `lib/ingest.ts`; since 2026-10-07 no per-game copy is stored (`Game.playedAt` was dropped — nothing read it), and the rule is unchanged. Displayed and sorted on `/matches`. See "playedAt: what it actually means" below. Null until detail-ingested — distinct from `createdAt`. |
| `createdAt` | DB default (`now()`), set when the row is first created — i.e. when the match was first ingested, not when it was played. |
| `ingestStatus` | Sync's own state (`PENDING`/`INGESTING`/`DONE`/`FAILED`); sync filters on it. |
| `ingestError` | Sync's operational log: a bounded one-line summary of the last failure (`lib/sync.ts`'s `summarizeError`). Not read by the app; kept as the log, by the user's choice (2026-10-07). |
| ~~`matchLength`~~ | **Dropped 2026-10-07.** Nothing read it. The length at any decision is that decision's Match ID length through `effectiveMatchLength` (see "Derived from raw"). |

## Game

| Column | Origin |
|---|---|
| `id` | Internal auto-increment key. |
| `matchId` | FK to `Match.id` (the internal key, not `sourceMatchId`). |
| `gameIndex` | The loop index used to fetch `game_reviews/{matchId}/{gameIndex}` (starts at 1). |
| ~~`playedAt`~~ / ~~`userScore`~~ / ~~`opponentScore`~~ / ~~`crawfordState`~~ | **Dropped 2026-10-07** (`reports/2026-10-07-column-audit.md`): no app code read them, only backfill scripts. The score, Crawford state and length at any decision come from that decision's own Match ID (see "Derived from raw"); `Match.playedAt` is computed at ingest without a per-game copy. |

### Score and Crawford: history

The score entering a game and its Crawford state were `Game` columns from
2026-10-02 to 2026-10-07. **Since 2026-10-06** they were decoded from the GNU
Match ID (see "GNU Match ID" below) of the game's first stored decision by
`eventId` — the same derivation that's now done on demand
(`lib/gnuMatchId.ts`'s `gameScoreFromMatchId` / `crawfordStateFor`):

- **Scores:** the Match ID holds absolute scores per GNU player. The user's
  score is the score of the user's seat (`PlayerIdentity.isMe` → black =
  player 1, white = player 0), the opponent's the other seat's. Seats
  resolve per match from the match's own decisions (each event's `color`
  where Galaxy filled it in, else the Match ID's dice owner for a move or
  turn for a cube decision — `addSeatEvidence`).
- **Crawford:** `"crawford"` when the Match ID's Crawford bit is set,
  `"post_crawford"` when it isn't but a player is 1-away, `"none"`
  otherwise. Matches Galaxy's own label on every local game of length 2+
  (7,471 of 7,471; an earlier "7,531" also counted the 60 money games,
  which agree too). For a 1-point match it's `"none"`: Galaxy changed its
  own label there over time (`"crawford"` on 60 old games up to match
  `40136106`, `"none"` from `40310886` on), with the Crawford bit clear in
  both, so the rule follows Galaxy's current behaviour.
- **Money game** (Match ID length 0, or an even decoded length — see
  "Even lengths are money" below): all three null.

**Why not `metadata.scores`.** Before 2026-10-06 the scores came from
`metadata.scores` of the game's first event with non-null scores, read as
"`black` = the actor, `white` = their opponent". That was wrong:
**`metadata.scores.white` is the score of the player on roll, and `black`
the other player's.** It isn't keyed by colour or by actor. That reading
swapped the two scores on about half of all games. The user confirmed it on
Galaxy (match `47816592` game 4 starts opp 4 – user 2; `45282503` game 2
starts user 1 – opp 0). Decoding the Match ID with the user's colour gives 0
inconsistencies across 1,965 matches; a plain swap still leaves 2 wrong
(`33002925` g3, `33013316` g6, where Galaxy's `metadata.scores` orientation
is itself anomalous). Also, `metadata.scores`/`match_length` are null on
Galaxy's older analyses (about 7,885 local games); the Match ID has it.

The even older `Decision.matchScoreBlack`/`matchScoreWhite`/`crawfordState`
columns were dropped 2026-10-02 (`reports/2026-10-02-raw-field-
reverification.md`).

### GNU Match ID

Every analysed event's `reviews[0].source_match.formatted_value` is a GNU
Backgammon Match ID: 12 base64 characters, 9 bytes. Decoded by
`lib/gnuMatchId.ts`'s `decodeGnuMatchId` (the one decoder; ingest, the
backfills and the display paths all use it). Take `lo` = bytes 0–7 as an
unsigned little-endian 64-bit integer, `hi` = byte 8:

| Bits | Field |
|---|---|
| 0–3 | log2(cube value) |
| 4–5 | cube owner: 0 = player 0, 1 = player 1, 3 = centred |
| 6 | dice owner (player on roll — the player the position ID is drawn from) |
| 7 | Crawford game |
| 8–10 | game state |
| 11 | turn (player to make the next decision — the receiver while a double is pending) |
| 12 | double offered |
| 13–14 | resignation offered |
| 15–17, 18–20 | die 1, die 2 |
| 21–35 | match length (0 = money) |
| 36–50 | score of player 0 |
| 51–65 | score of player 1: `((lo >> 51) & 8191) \| ((hi & 3) << 13)` |

Galaxy's match-play IDs also set `0x04` in byte 8 (above the 66 decoded
bits); nothing reads it.

**Even lengths are money** (since 2026-10-07). Galaxy matches are always
odd lengths (1, 3, 5, 7…). Five old single-game "matches" decode to an even
length, and each one's final score can't happen at that length — they're
money games whose Match IDs apparently reuse the length bits:

| Galaxy match | Decoded length | Final score (user–opp) |
|---|---|---|
| `72588` | 8 | 0–1 |
| `72587` | 8 | 0–1 |
| `72577` | 8 | 0–1 |
| `19719` | 8 | 1–0 |
| `249289` | 16 | 4–0 |

So an even decoded length means money: length 0, and no score or Crawford
state, exactly like length 0. `decodeGnuMatchId` still returns the literal
bits; the rule lives in one helper, `lib/gnuMatchId.ts`'s
`effectiveMatchLength`, used by `gameScoreFromMatchId` and
`crawfordStateFor`. No display path reads the length today (the live and DB
paths read the cube and the dice from the Match ID).

**Player 1 = black, player 0 = white.** Verified on every local CHECKER row
(595,845): the event's `color` (then also the `Decision.color` column)
always equals the dice owner's colour. The
decision's actor is the dice owner on a move, and the turn on a cube
decision (`cube_double`: 663,169 rows; `cube_pass`: 6,999 rows, where the
double-offered bit is set and the turn is the receiver). Resignations don't
follow either rule reliably (actor ≠ turn on 70 of 1,893 checkable rows), so
they aren't used as seat evidence.

**The double a take/pass answers** (display only, since 2026-10-07).
Galaxy doesn't analyse the doubler's offer as its own event when only the
receiver had a decision, so the replay labels each `cube_pass` step with it
("Opponent redoubles to 4: you took"). `lib/cubeState.ts`'s
`doubleOfferFor` reads it from the row's own `raw`: the offered value is
twice the Match ID's cube value (the cube entering the decision), it's a
redouble when the Match ID's cube owner is set, and took/passed is
`reviews[0].take`. No column. **The board draws it too** (since 2026-10-07): on a take/pass, the offered value is drawn centred horizontally on the receiver's edge of the playing field (on the bar column, flush with the edge), as Galaxy's own board draws a pending double, instead of the current cube beside its owner — `lib/boardFrame.ts`'s `boardCubeFor` / `lib/boardGeometry.ts`'s `offeredCubeCenter`. The receiver is at the bottom, except in the replay's fixed perspective on an opponent's take/pass (then at the top). Every other decision keeps the owned-cube placement.

**Evidence it's right:** the decoded length equals `metadata.match_length`
on every row where that's set; the decoded cube agreed with every row the
retired take-walk had been confident about except 27 (all match `46000168`
game 4, where the start of the game is missing from Galaxy's stored events
and the user won it for exactly 2 points, so the Match ID is very likely
right); every one of the 1,268,047 local Decision rows decodes; and the user confirmed the cube on Galaxy's site in 5 cases
(`reports/2026-10-06-examples-to-check.md`, A1–A5: match `45282503` g2
`QQmxAAAACAAE` 2-cube on the opponent's side, `ARmgAAAACAAE` the opponent's
redouble, `EgGgAAAACAAE` 4-cube on the user's side; `30873806` g2
`EQGvABAAAAAE` 2-cube on the user's side, g5 `UQmgADAAEAAE` a redouble to 4).

### `playedAt`: what it actually means (and its permanent limitation)

`metadata.timestamp` is **not** a historical "when this move was played" fact —
it's stamped with whenever Galaxy served that specific analysis in response
to a request. Confirmed directly, twice: re-fetching the exact same
match/event a few seconds apart returns a timestamp that advances by the
same few seconds each time, and checking known-ancient matches (by their
position deep in `analyses/list` pagination — years old by any reasonable
account-history reading) showed their stored `playedAt` landing within
*minutes* of `SyncRun.startedAt` for whichever backfill run first requested
them, not any plausible real play date. This holds even for the very first
decision of a game specifically (not just an average across the match) —
tested directly against 10 known-ancient matches, all of which clustered
into the same 6-minute window regardless of how old the match actually was.
No alternative timestamp source exists anywhere in Galaxy's API either:
`game_started` events never carry a `reviews[0]`/`metadata` at all (checked
across matches from a few hours old to years old), and `analyses/list`'s
per-match payload has no date-like field of any kind — only `matchId`,
which correlates with recency but isn't a date. The only fallback ever
available is *relative* ordering (page position / `matchId` magnitude), not
an exact calendar date.

Given that, `playedAt` is populated the way described above anyway — a
deliberate, known-imperfect choice, not an oversight. For a match ingested
shortly after being played (the normal case going forward via incremental
sync), "when we first requested this match's analysis" and "when it was
played" are close enough to be genuinely useful. It only breaks down for a
large historical backfill run happening long after the matches themselves —
which is exactly what the original 2026-09 backfill was. **Every `playedAt`
value produced by that backfill batch (the bulk of this app's historical
data) reflects when this app's ingest process happened to request that
match, clustered by whichever `SyncRun` touched it — not a real play date,
and there is no way to recover the real one.** This is a permanent,
accepted limitation of the historical data, not a bug to keep chasing.

`scripts/backfill-played-at.ts` reconciles every already-ingested match's
`Match.playedAt` to the rule above (re-derived from stored `Decision.raw`
JSON, no live Galaxy calls; since 2026-10-07 it no longer touches the
dropped `Game.playedAt`) — useful for keeping stored values self-consistent
with `lib/ingest.ts`'s current rule if that rule ever changes again, but it
does not and cannot fix the historical backfill's fundamentally wrong dates,
for the reason above. Its 2026-10-07 local dry run: 4,378 matches, 0 would
change, 1 with no stored decision (`6029642`).

## Decision

One row per event in a game's `events` array that has a non-empty
`reviews[0]` — `game_started`/`game_over`/`turn_forfeited` events are
excluded explicitly (they're never decisions), and any event whose
`error_analysis` is `null` is also skipped as a non-decision (see "Events
skipped via null error_analysis" below). Rows are stored regardless of
`countAsDecision`'s value; filtering by it happens at read time
(`lib/mistakes.ts`'s `extractDecisions`), not at ingest.

**Columns earn their place** (CLAUDE.md, since 2026-10-07): a value is a
column only if SQL filters, sorts, groups or counts by it, if deriving it
needs other rows, or if a view shows many rows without loading `raw`.
Everything else is read from `raw` on demand — see "Derived from raw" below.

| Column | Origin |
|---|---|
| `id` | Internal auto-increment key. |
| `gameId` | FK to `Game.id`. |
| `eventId` | `event.id` (the original event's id from the payload), as `BigInt`. Unique per `(gameId, eventId)` — this is what makes re-sync idempotent. |
| `userId` | `event.user_id` — whichever player made this decision, not necessarily "you". |
| `kind` | `CHECKER` for `"move"`, `CUBE` for `"cube_double"`/`"cube_pass"`, `RESIGNATION` for `"resignation"` — an exact mapping (`decisionKindFor` in `lib/ingest.ts`), never a fallback/else. Any other `analysed_event` is logged as a warning and skipped rather than guessed (see "Unrecognized analysed_event" below). |
| `countAsDecision` | `metadata.count_as_decision` |
| `rawError` | `error_analysis.raw_error`, unmodified (not absolute-valued — the app layer takes `Math.abs()` where it needs magnitude). **Nullable** — confirmed against real data (match `32699544`): some events have a non-null `error_analysis` (real `error_severity`/`is_blunder`/`luck` values) but a null `raw_error` — `analysis_level: 1`, `error_severity: "doubtful"`, `event_type: "dice_rolled"` paired with `analysed_event: "cube_double"` — a partial/low-confidence analysis that grades severity without computing an equity-error magnitude. `lib/mistakes.ts`'s `extractDecisions` excludes `rawError: null` decisions entirely from PR (both numerator and denominator) — same treatment as `count_as_decision: false` and an unrecognized `analysed_event` — rather than letting `Math.abs(null)` silently coerce to `0` and count an ungraded decision as a zero-error clean play. |
| `errorSeverity` | `error_analysis.error_severity`, mapped from the payload's lowercase string to the `NONE`/`DOUBTFUL`/`ERROR`/`BLUNDER` enum. **Displayed with Galaxy's names and colours** (since 2026-10-07): `NONE` "Best" (green `#36D399`), `DOUBTFUL` "Good" (slate `#65758B`), `ERROR` "Error" (amber `#FBBD23`), `BLUNDER` "Blunder" (red `#F43E5C`) — `lib/badges.ts`'s `severityTier`/`severityLabel`, colours in `lib/styles/shared.styles.ts`. **`DOUBTFUL` is a mild "Good" tier, not an error** (`lib/mistakes.ts`'s `severityFromErrorSeverity`: doubtful → `"good"`; before 2026-10-07 it was folded into `"error"`): the per-match mistake lists leave Good rows out (`isListedMistake`), while PR math is unchanged (equity-based; it never read severity). The stored values, the /mistakes and /repeated-positions severity filter values (`?severity=doubtful` etc.) and `MistakeStat`/`RepeatedPosition` (which group by the stored value, one bucket per severity, and never folded DOUBTFUL into ERROR) are unchanged; only labels and colours changed. |
| `classification` | Displayed with Galaxy's own names (since 2026-10-07, `lib/classificationLabels.ts`'s `CLASSIFICATION_LABELS_BY_RAW_VALUE`, from Galaxy's web client's blunder-categories page): `opening_game` "Opening game", `middle_game` "Middle game", `race` "Race", `early_blitz` "Blitz, early", `blitz` "Blitz, middle and late", `attacking_game` "Attacking game", `mutual_holding_game` "Mutual holding game", `one_man_back` "One man back", `holding_game` "Holding game", `deep_anchor_game` "Deep anchor game", `end_game_contact` "Endgame contact", `crunching_game` "Crunching game", `6_prime` "6 prime", `early_backgame` "Backgame, early", `late_backgame` "Backgame, late", `late_game_hit` "Late game hit", `close_out` "Close out" (Galaxy's display order). Our own Phase buckets ("Opening (both plies)", "1st roll", …) keep their labels; an unknown key shows as itself. **`review.source_position.classification` only — never `destination_position`.** The analysis is about the quality of a decision made *at* a position, so the phase that matters is the board state before the move (source), not after (destination); falling back to destination would silently mislabel the decision's phase. If `source_position`/`.classification` is ever actually missing, ingest throws for that one decision (caught, recorded in the ingest summary's `errors`) rather than silently substituting destination. |
| `sourcePositionId` | `review.source_position.formatted_value` (the GNU Position ID of the board *before* this decision — same source object `classification` reads from, just not hard-failing if missing). Added as a real column (previously re-parsed from `raw` on every read) specifically to replace two unindexed `JSON_EXTRACT` call sites — see `findPositionOccurrences` (`lib/decisionQueries.ts`) and "Collation for externally-sourced identifiers" above, and `reports/2026-10-02-step3-sourcepositionid-column-design.md` for the full before/after measurements (unforced ~28.4s / `FORCE INDEX`-forced ~21.2s / new column+index ~0.3s, same real worst-case literal). Confirmed 100% real-data coverage; nullable only for migration-sequencing reasons, same as `plyNumber`. |
| `plyNumber` | Not in the payload directly — computed at ingest from `eventId` order alone (see "Ply number" below). `1`-`4` for a game's first four `CHECKER` decisions (by `eventId` ascending), `null` beyond that and always `null` for `CUBE`/`RESIGNATION` kind. |
| `raw` | The complete original `event` object (not just `reviews[0]`) — the zero-blind-spot archive `getGameReviews` reconstructs a game's events array from, and the source of every value in "Derived from raw" below. **Never modified.** |

Dropped columns, for reference: `isBlunder`, `matchScoreBlack`/
`matchScoreWhite`/`crawfordState` (2026-10-02, `reports/2026-10-02-raw-
field-reverification.md`); `color`, `analysedEvent`, `luck`, `luckMwc`,
`equity`, `mwc`, `cubeOwnerUserId`, `cubeValue`, `cubeConfident`, `roll`,
`movePlayed`, `moveBest`, `cubeActionPlayed`, `cubeActionBest`,
`resignError`, `shouldResign`, `resignationType`, `equityBefore`,
`equityAfter`, `timestamp`, `myTag` (2026-10-07, `reports/2026-10-07-
column-audit.md`; migration `20261007180000_drop_derivable_columns`).

### Derived from raw

Each value below is read from the decision's own `raw` when it's needed,
through the source dispatcher `lib/analysis/index.ts` (which picks the
reader for `Match.source`; Galaxy's are in `lib/analysis/galaxyFields.ts`).
One rule per value, shared by the DB-row path (`lib/decisionFromRow.ts`:
/mistakes, /repeated-positions, the replay) and the live path
(`lib/mistakes.ts`'s `extractDecisions`: /matches/[matchId], whose events
are rebuilt from stored `raw`, and /galaxy/matches/[matchId]). `raw` is
never modified.

| Value | Derivation | Replaces |
|---|---|---|
| Roll | The Match ID's dice (bits 15–20), shown **higher die first** (6-3, never 3-6, as Galaxy's client shows them; display only, since 2026-10-07 — before that the Match ID's own order) — **checker moves only**; cube decisions (made before the roll) and resignations show no dice. Empty when the Match ID is missing or its dice aren't 1–6. `lib/gnuMatchId.ts`'s `diceRollFor` (dispatcher: `decisionRoll`). | `Decision.roll` |
| Cube | The Match ID's cube value and owner, the owner relative to the stored position's on-roll player (the dice owner): `lib/cubeState.ts`'s `cubeStateFromMatchId` (`decisionCubeState`). No cube when the Match ID is missing or doesn't decode. | `cubeValue`, `cubeOwnerUserId`, `cubeConfident` |
| Labels and move notations | Played/best candidate (`move_played`; `rank === 1`, else the first) for a move; `actionLabels` for cube (`reviews[0].double`/`take`) and resignation decisions, put in Galaxy's wording with the best cube action derived from the equities (`displayLabels`, see "Cube action from the equities" and "Cube wording"); `moveNotations` for the notations (`decisionLabels`). | `movePlayed`, `moveBest`, `cubeActionPlayed`, `cubeActionBest` |
| Colour | `raw.color` (often blank on cube rows; the replay resolves each player's colour from any of their rows) (`decisionColor`). | `Decision.color` (equal to `raw.color` on every row) |
| Event type | `reviews[0].result.analysed_event`, read inside the Galaxy readers and translator (`galaxyAnalysedEvent`); `getDecisionAnalysis({ source, raw })` no longer takes it as a parameter. `Decision.kind` stays a column (SQL uses it). | `Decision.analysedEvent` |
| Board frame | Take/pass flip, the double a take/pass answers, and the cube square a cube row shows in the lists' Roll column instead of dice (the offered value on a double or take/pass, the current cube on a no-double check; red for blunder, amber for error, blue `#2C44FF` otherwise): `positionFromOpponent`/`doubleOfferFor`/`cubeListValue` on the Match ID (`decisionBoardFrame`). | (never columns) |
| Score and Crawford at a decision | The Match ID's scores through the user's seat, and its Crawford bit: `gameScoreFromMatchId` / `crawfordStateFor` (pass a game's first decision for the score entering the game). No view reads them today. | `Game.userScore`, `Game.opponentScore`, `Game.crawfordState` |
| Match length | The Match ID's length through `effectiveMatchLength` (an even decoded length means money, 0). | `Match.matchLength` |
| Match context (review cards) | Length, both scores from the **decision-maker's** seat (`actorPlayerFor`: the dice owner on a move, the turn on a cube decision, so the receiver on a take/pass) and the Crawford state, all from the decision's own Match ID: `galaxyMatchContext` (`decisionMatchContext`). Null for a resignation or no Match ID. Shown as "5-point match · you 3 – opp 2 · Crawford" / "money game" (`lib/review/format.ts`). | (never a column) |
| Play order | `eventId`. `lib/local-client.ts`'s `getGameReviews` (the /matches DB path) sorted by `timestamp, id` until 2026-10-07; `timestamp` is Galaxy's serve time, which disagreed with `eventId` order on 116,682 rows in 10,769 local games. | `Decision.timestamp` |
| Resignation detail, luck, equity, mwc | `reviews[0].result.result.resign_error`/`should_resign`/`resignation_type`/`equity_before`/`equity_after`, `error_analysis.luck`/`luck_mwc`, `result.equity`, `probabilities.mwc`. Nothing reads them. | the same-named columns (`myTag` was always null) |

**The roll fix.** The old `roll` column came from a scan back to the
nearest preceding `dice_rolled`/`game_started` event. The Match ID's dice
match the move played on every local checker row; the column disagreed on
224 of 595,845, where it was wrong — most in 7 matches in the
35478993–35484209 range, e.g. decision `749213` (match `35478993` g6,
`23/21 15/10`): column 3-3, Match ID 5-2. On 7,831 more the column had the
same dice in the other order; the Match ID's order is shown now. The
/matches page was worse off: it rebuilt each game's events in `timestamp`
order and ran the same scan over them, so on a sample of 182 local matches
(25,883 counted decisions) its dice differed from the column on 10,117
(about 39%); it now shows the Match ID's dice too. Its decision order is
now `eventId` order; on that sample, 4 of 3,344 per-player mistake lists
(2 matches) changed order — only equal-error ties, now in `eventId` order.

**Resignations** appear only as steps in the game replay (label "Resign",
no dice, no analysis). They're left out of every mistake list and filter
(/mistakes, the per-match lists, /repeated-positions) and every stat
(`MistakeStat`, `RepeatedPosition`, PR): `lib/listParams.ts`'s
`LISTED_KINDS` is checker and cube, `?category=resignation` is no longer a
category (an unknown value means no category filter), and
`recomputeMistakeStats` groups those two kinds only.

### Normalized decision analysis (derived, not stored)

A source-neutral view of a decision's engine analysis for the review cards
(Phase B of `reports/2026-10-07-review-feature-plan.md`), so the cards never
read a source's own `raw`. **It isn't stored.** It's derived on demand from
the decision's own `raw` each time it's needed. The user decided this on
2026-10-07: only the review cards need it, and they load about 20 decisions
at a time. Storing it would have added about 1.5 GB to `Decision` and needed
a 600k-row backfill on Oracle, with its binlog volume. (Phase A briefly
stored it as a `Decision.analysis` column, locally only; Phase A01 removed
the column and its migration before either reached Oracle.)

**`raw` is never modified.** It stays Galaxy's untouched payload. Nothing of
ours is written into it, the normalized analysis included.

**One entry point:** `lib/analysis/index.ts`'s
`getDecisionAnalysis({ source, raw })`, where `source` is the
match's `Match.source`. It picks the translator for that source and returns
null for an unknown one:

| `Match.source` | Translator |
|---|---|
| `galaxy` | `lib/analysis/galaxy.ts`'s `galaxyAnalysis(raw)` |

A future source (e.g. an XG import) adds its own translator, filling the
same shape, and a case in `getDecisionAnalysis`. Translators are pure (no
DB, no network) and only read `raw`. Types are in `lib/analysis/types.ts`.

```ts
type DecisionAnalysis =
  | { v: 1; source: "galaxy"; kind: "checker";
      candidates: { move: string; rank: number; equity: number; loss: number; played: boolean;
                    probs: { win: number; winG: number; winBG: number; loseG: number; loseBG: number } | null }[] }
  | { v: 1; source: "galaxy"; kind: "cube"; role: "doubler" | "receiver"; nd: number; dt: number; dp: number };
```

**`v` versions the shape.** Changing the shape, or how a translator fills
it, bumps `v`.

The translator reads the event type itself, from `raw`'s
`reviews[0].result.analysed_event` (since 2026-10-07, when the
`Decision.analysedEvent` column it used to be passed was dropped). The same
dispatcher also serves the display values that used to be columns — see
"Derived from raw" above.

**Checker** (`analysed_event` `move`), from `reviews[0].result.result.moves[]`:

| Field | From Galaxy |
|---|---|
| `move` | `notation`, unchanged (e.g. `"14/12* 12/8"`, `"Bar/22*"`) |
| `rank` | `rank`, for reference only — not the sort key |
| `equity` | `equity` |
| `loss` | `equity` − the best candidate's `equity`: ≤ 0, and 0 for the best. Computed, not read from `equity_error` |
| `played` | `move_played` |
| `probs` | `probabilities.win`/`win_gammon`/`win_backgammon`/`lose_gammon`/`lose_backgammon` → `win`/`winG`/`winBG`/`loseG`/`loseBG`; null if any is missing |

`candidates` is sorted by equity, best first, with exact-equity ties broken
by Galaxy's rank ascending. Galaxy's rank isn't always in equity order:
on 2,188 counted local rows rank 1 isn't the best candidate. On 1,367 of
them the best candidate is rank 4 or 5; on 686 it's rank 3 and on 135
rank 2. E.g. match `46875560` g4,
roll 4-2 (decision `1236446`): rank 3 `20/14` is best. Galaxy's own UI keeps
rank order. The user's decision: the equities decide.

Galaxy's decision-level `rawError` can also disagree with the candidates. On
99 rows the played move is rank 1 but `rawError` is negative, measured
against a better candidate (e.g. match `33015498` g7, roll 1-3, decision
`668067`: the played rank-1 `17/14*/13` is 0.3089 worse than rank 2
`17/14* 4/3*`). On 13 more, `rawError` is positive while the played move is
the best.

**Our `loss` vs Galaxy's `rawError`.** `loss` is measured against the true
best candidate by equity; Galaxy's `rawError` against its rank 1. The two
differ on 2,016 counted checker rows. Galaxy's `rawError` and severity are
still what the app uses for the decision lists and PR. The user is fine with
a review card showing our `loss` without comment.

Lists hold 1–5 candidates and always include the played move. Ranks 4 and 5
appear both when Galaxy appends the played move because it isn't in its top
3 (e.g. `47816592` g1, roll 3-3) and when the played move is in the top 3
(e.g. decision `668067` above: played rank 1, plus ranks 2–4). A list that
is empty, has a malformed candidate, or doesn't have exactly one played move
gives null.

**Cube** (`cube_double` → `role: "doubler"`, `cube_pass` → `role:
"receiver"`), from `reviews[0].result.result.cube_analysis`'s `no_double`/
`double_take`/`double_pass`, **always in the doubler's view**. `cube_pass`
rows are stored negated (DP = −1, the receiver's view) except 4 local rows in
matches `33002925`/`33013316` (DP = +1); `lib/cubeAction.ts`'s
`doublerViewEquities` multiplies by the sign of DP, once, at translation —
the same function the cube action display uses (see "Cube action from the
equities" below). So every counted cube decision translates with DP = 1
locally (84,743 doubler and 6,999 receiver rows, measured while Phase A
stored it). Missing equities give null.

**Everything else is null:** resignations, and any unknown or missing `analysed_event`.

**Precision.** Galaxy gives equities to 4 decimals but probabilities often
to 5. Both are rounded to 4; `loss` is computed from the rounded equities,
and nothing is ever −0.

**Ingest check.** Since nothing is stored, `lib/ingest.ts` checks instead:
for every counted decision (`count_as_decision` true and `raw_error` not
null) of kind `CHECKER` or `CUBE`, it runs `getDecisionAnalysis` on the
event. A null result logs a warning (`console.warn` +
`IngestSummary.warnings`: match id, game index, event id and
`analysed_event`) and counts in `IngestSummary.analysisMissing`, which
`lib/sync.ts` prints on its per-match line (`… N analysis-missing`). It's a
signal, not a blocker: the decision is stored as usual. Resignations are
expected to be null and aren't checked.

### Ply number

`Decision.plyNumber` (and the mirrored `RepeatedPosition.plyNumber`, an
independent grouping dimension on that precomputed aggregate alongside
`classification`/`errorSeverity`) is a game's own `CHECKER` decisions
numbered 1, 2, 3, 4 in `eventId` order — `null` beyond the fourth, and
always `null` for `CUBE`/`RESIGNATION` kind (deeper plies aren't a useful
filter dimension; see `lib/ingest.ts`'s `checkerPlyByEventId`).

**This replaced an earlier, now fully removed approach.** The original
"Opening (first move)" vs. "Opening (response)" filter split
`classification: opening_game` into two dropdown options by matching each
decision's source position against `STARTING_POSITION_ID`, a hardcoded GNU
Position ID (`4HPwATDgc/ABMA`) for the standard backgammon starting
position. That worked, but it was chosen for the wrong reason: it's a
**Galaxy-specific encoding artifact** — the GNU Position ID format is one
particular way of serializing a board position, and matching against a
literal constant in that format has no equivalent in a different data
source's encoding. This app already has a future data source on its
roadmap (importing `.xgp`/`.xg` files, XG's own formats) that would need an
entirely separate position-matching constant and comparison logic, with no
guarantee its encoding even supports the same kind of exact-string
equality check GNU Position IDs happen to allow.

Ordinal ply position has no such dependency. "The Nth checker decision of
this game" is a property of *when* a decision happens in a game's move
sequence, not of *how* any particular data source chooses to serialize the
resulting board state — every plausible future source reports decisions in
some game-relative order, so the same `eventId`-ascending counting rule
(or that source's equivalent ordering field) applies unchanged. This is why
it's modeled as a genuinely separate, independent filter dimension (`ply`,
usable alongside `classification`, not a per-classification split) rather
than another `extraFilter` layered onto `CLASSIFICATION_OPTIONS` the old
approach used — the two dimensions don't need to know about each other.

One data point worth recording: the old approach's "response" bucket
(`opening_game` rows *not* matching `STARTING_POSITION_ID`) counted 30,985
rows against the "first move" bucket's 15,395 — an unexplained ~2:1 ratio,
since a game's very first response should be roughly as common as its very
first move. Ordinal ply resolves this cleanly: ply 1 and ply 2 come out to
15,311 and 15,200 respectively (see `scripts/backfill-ply-number.ts`'s
output, and `PROGRESS.md`'s entry for this change) — a genuine, expected
near-1:1 ratio. The old discrepancy was an artifact of position-ID matching
(most likely: a meaningful slice of "opening_game" decisions whose source
position isn't the literal starting position turn out to still be
*earlier* than the classification's typical response point once measured
by ply directly, or some other position-matching quirk) rather than a real
gameplay asymmetry — not fully root-caused, and no longer relevant now that
the whole matching approach is gone, but recorded here since it's a
concrete illustration of why ply is the more robust dimension.

**`Decision.plyNumber` index.** No index covers `plyNumber` on its own —
the pre-existing composite index
(`countAsDecision, rawError, kind, classification, errorSeverity`) doesn't
include it at all, so `/mistakes`' ply-based Phase filter
(`?phase=ply_N`) originally forced a full table scan (~1M rows, measured
5-43s depending on the rest of the filter). Fixed with
`@@index([plyNumber, countAsDecision, eventId])`.

Two composite shapes were measured with `EXPLAIN` before choosing:
- **Wide** — `(plyNumber, countAsDecision, kind, errorSeverity, eventId)`.
  Excellent for the one case where every column is filtered (severity *and*
  category both given — an index lookup straight to the ~500-row match), but
  catastrophic otherwise: `kind`/`errorSeverity` sitting between
  `countAsDecision` and `eventId` means dropping either one from the query
  breaks the physical eventId ordering the index would otherwise provide,
  forcing an in-memory sort. Measured 500-950ms on the 3 of 5 realistic
  filter combinations that don't specify `errorSeverity` — worse than doing
  nothing extra for those cases.
- **Narrow** (chosen) — `(plyNumber, countAsDecision, eventId)`. Since
  `plyNumber` alone already narrows ~1M rows down to roughly 15-30k for any
  given value, and `countAsDecision` is the one other condition `/mistakes`
  always applies unconditionally, putting `eventId` immediately after both
  keeps `ORDER BY eventId DESC` satisfiable directly from the index (a
  reverse range scan) in every case, regardless of whether `kind`/
  `errorSeverity` are filtered — they become cheap residual checks on an
  already-small candidate set instead. Measured 1-12ms across all 5 filter
  combinations, both locally and on Oracle.

`rawError` isn't part of this index — like `kind`/`errorSeverity` when
unfiltered, `IS NOT NULL` stays a residual filter on the narrowed set,
which is cheap enough not to need indexing separately.

Measured before/after, both locally and on Oracle (`PROGRESS.md`'s entry
for this fix has the full table): roughly 20-100x faster locally (up to
43s → ~0.5s, the remainder being `COUNT(*)`'s inherent need to scan every
matching row even with the index), and roughly 10-20x faster on Oracle
(~1.3-2.6s → ~0.12-0.15s). Confirmed via `EXPLAIN` that
`recomputeMistakeStats`/`recomputeRepeatedPositions`/`PositionDetailSection`
(the other queries touching `Decision`'s existing indexes) still pick the
exact same indexes as before — a new index can only help or be irrelevant
to an unrelated query, and this one only ever gets chosen when `plyNumber`
is actually in the `WHERE` clause.

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

### Null `rawError`: three different behaviors, by design

`rawError`'s own row above documents its nullability (a non-null
`error_analysis` can still carry a null `raw_error` — a partial/low-
confidence analysis that grades severity without computing an equity-error
magnitude). What it doesn't spell out is that the three read paths that
consume it each treat a null `rawError` differently — a real inconsistency
across call sites, flagged by the 2026-10-01 raw-field audit
(`reports/2026-10-01-decision-raw-field-audit.md`, cross-cutting finding
#2) as worth documenting explicitly rather than leaving buried in three
separate code comments:

- **`lib/mistakes.ts`'s `extractDecisions`** (live-fetch: `/matches`,
  `/galaxy/matches`) — **excludes the decision entirely**, from both the PR
  numerator and denominator. An ungraded decision isn't a zero-error clean
  play, so it's treated the same as `count_as_decision: false` and an
  unrecognized `analysed_event`: skipped, not faked as a zero.
- **`lib/decisionFromRow.ts`'s `decisionFromRow`** (DB-row: `/mistakes`,
  non-replay) — **drops the row**, returning `null` so the caller filters
  it out of the list entirely. Same end result as `extractDecisions` (the
  decision never appears), different mechanism (a row-level `null` return
  vs. a loop-level `continue`).
- **`lib/decisionFromRow.ts`'s `decisionFromRowForReplay`** (DB-row:
  `app/matches/[matchId]/replay/[gameIndex]`) — **keeps the row**, treating
  a null `rawError` as `absError: 0`. A replay shows the game exactly as
  played, not a mistake-filtered view, so a row with no review data at all
  is the only thing that returns `null` here — an ungraded decision still
  gets a step in the sequence, just with no error to show.

Each behavior is correct for its own view's purpose (a mistake list
shouldn't show ungraded decisions at all; a replay shouldn't silently skip
a step in the game). Documented here so the divergence reads as a
deliberate, audited set of three choices, not an unnoticed inconsistency.

### Two real "unindexed JSON access is slow" incidents

Before `Decision.sourcePositionId` existed as a real column (added
2026-10-02, see `reports/2026-10-02-step3-sourcepositionid-column-design.md`),
every read of a decision's board position re-parsed it from `raw` via
`JSON_EXTRACT`/`JSON_UNQUOTE`, unindexable by MySQL. This produced two real,
measured incidents — the exact evidence the 2026-10-01 raw-field audit's
performance heuristic leaned on (cross-cutting finding #5) to recommend
building the column, flagged at the time as living "only in code comments,
not in this doc":

- **`lib/recompute-repeated-positions.ts`**: a grouped SQL query (`GROUP BY`
  the JSON-extracted position, counting occurrences) measured at **341
  seconds** for just 4 groups, since MySQL had no index on the extracted
  expression and re-scanned/re-sorted per group. Fixed by dropping the
  `GROUP BY` entirely in favor of one unaggregated extraction (~2 seconds
  for ~502k rows) plus in-JS grouping via a plain `Map` — still the current
  shape even after the column existed, since the column's win there is a
  cheaper per-row projection, not a different query shape (the query's
  `WHERE` clause doesn't share a prefix with the new
  `(sourcePositionId, errorSeverity)` index, so SQL-level grouping still
  can't be satisfied by an index scan).
- **`lib/decisionQueries.ts`'s `findPositionOccurrences`**: MySQL's
  optimizer picked a kind-only index over the composite index that also
  covered `countAsDecision`/`rawError`/`errorSeverity`, measured at **11.4
  seconds** unforced vs. **1.2 seconds** with a `FORCE INDEX` hint for the
  identical query. The hint was the workaround until the column existed;
  once `sourcePositionId` became a real, indexed column, the hint became
  fully unnecessary — the new `(sourcePositionId, errorSeverity)` index
  dominates every other candidate by 2-3 orders of magnitude on the most
  selective predicate, so the optimizer no longer needs steering (confirmed
  via real `EXPLAIN` and wall-clock timing: ~0.3 seconds, no hint). The
  `FORCE INDEX` code and its explaining comment were removed once this was
  confirmed — this section is where that historical justification now
  lives instead.

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

The general columns (`rawError`, `errorSeverity`, `classification`) come
from `error_analysis`/`source_position`, same as every other kind — no
special-casing needed there. The resignation-specific fields aren't
columns (since 2026-10-07; nothing read them): they stay in `raw`.

**Resignations are replay steps only** (since 2026-10-07): "Resign", no
dice, no analysis (`getDecisionAnalysis` returns null). They're left out of
every mistake list, filter and stat — see "Derived from raw" above.

**RESIGNATION decisions are excluded from checker/cube PR calculations.**
`lib/mistakes.ts`'s checker/cube PR buckets are built by filtering on
`kind === "checker"` / `kind === "cube"` — a `"resignation"`-kind decision
matches neither filter and is naturally excluded from both totals, the same
way checker and cube decisions already never blend into each other. This is
deliberate: a resignation decision (should I resign given the current
equity?) isn't directly comparable to either a checker-play or a cube
decision, so folding its error into one of those buckets would just pollute
the stat with an unrelated decision type.

### Cube action from the equities

Galaxy's `cube_analysis.doublers_best_action` (and `optimal`) is stuck at
"roll" on about 18k counted cube decisions in its older analyses, while
`raw_error` (the grade) follows the real equities — e.g. decision `629849`
(match `29939852` g1): ND 0.7922, DT 0.9751, best "roll", but not doubling
is graded BLUNDER −0.183. So the app works out the correct action itself
(`lib/cubeAction.ts`, display only: `rawError`/severity stay Galaxy's, no new
column, no backfill).

The user's table for the **doubler's** decision (`cube_double` rows; ND =
`no_double`, DT = `double_take`, DP = `double_pass`), which is also
Galaxy's own rule ("Too good" if ND > DP, otherwise "Double" if DT > ND,
otherwise "No Double" — `reports/2026-10-07-galaxy-client-comparison.md`):

| ND | DT | Correct action |
|---|---|---|
| ≤ DP | ≤ DP | Double/take if DT > ND, otherwise No double/take |
| ≤ DP | > DP | Double/pass |
| > DP | > DP | Too good/pass |
| > DP | ≤ DP | Too good/take |

Tie rules: DT == ND (both < DP) → No double/take; **ND == DP is not too
good** → Double/pass when DT > DP, No double/take otherwise; DT == DP → the
take side. The ND == DP rule follows Galaxy since 2026-10-07 (before that,
ND == DP was the too-good branch): 542 counted local `cube_double` rows have
ND == DP, e.g. decision `662455` (match `33173703` g2: ND = DP = 1, DT
2.8281), now Double/pass where it was Too good/pass.

The code compares against DP rather than a literal 1. **DP is 1 on every
counted `cube_double` row** locally; it differs (0.18–0.91) only on 89,593
uncounted pre-roll checks, which the app doesn't show.

**The receiver's decision** (`cube_pass` rows): the stored values are the
doubler's negated (DP = −1), so "take if −DT ≤ −DP" — i.e. take if the
doubler-view DT ≤ DP, pass otherwise. 4 local `cube_pass` rows (matches
`33002925`, `33013316`) aren't negated (DP = +1); multiplying by the sign of
DP handles both. The derived action is "Take" or "Pass".

**No comparison with Galaxy's stored labels** (since 2026-10-07). Galaxy's
own site never shows `doublers_best_action`/`receivers_best_action`; it
derives the verdict from the equities, as the app now does. The "Doesn't
match Galaxy" badge (`GalaxyMismatchBadge`) and the comparison behind it
were removed.

### Cube wording

Display only (since 2026-10-07; `lib/cubeAction.ts`'s `cubePlayedLabel`/
`cubeBestDisplay`, applied in `lib/mistakes.ts`'s `displayLabels` — shared by
the live path and `lib/decisionFromRow.ts`, so every view shows the same
words: BoardPanel, MoveDelta, the decision lists, the replay, /mistakes,
/matches and /galaxy). Galaxy's own words and casing:

| Played label (`actionLabels`, from `raw`) | Shown |
|---|---|
| `did not double` | No Double — or **Too good** when ND > DP (the derived action is a Too good one) and the severity is none or doubtful, as Galaxy shows it |
| `doubled` | Double |
| `took` | Take |
| `passed` | Pass |
| `resigned` (resignation) | Resign |

| Derived best action | Shown | Small grey secondary text |
|---|---|---|
| No double/take | No Double | — |
| Double/take | Double | opponent should take |
| Double/pass | Double | opponent should pass |
| Too good/take | Too good | opponent should take |
| Too good/pass | Too good | opponent should pass |
| Take / Pass | Take / Pass | — |

"Too good" has a lowercase g, as on Galaxy. The secondary text is the
opponent's half of the action, which Galaxy shows only in its cube table;
the user wants it kept (`Decision.bestDetail`). Values read from `raw` for
this: `cube_analysis.no_double`/`double_take`/`double_pass` (the derived
action) and `error_analysis.error_severity` (the "Too good" exception; both
paths read it from `raw` since 2026-10-07 — the DB path used to pass the
row's `errorSeverity` column, the same value). When the equities are
missing the best label falls back to Galaxy's own label, unchanged. The replay's take/pass sentence ("Opponent redoubles to
4: you took") stays.

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
doesn't actually exist. Since 2026-10-06 the signal is a Match ID length of
0 (the GNU Match ID's own money-game encoding, or an even decoded length —
`effectiveMatchLength`, see "GNU Match ID"), read from any decision's
`raw`; nothing is stored for it (the `Match.matchLength` column was dropped
2026-10-07). A real category flag can be added later if it's ever needed.

## Review cards and tags (since 2026-10-07)

Phase B of `reports/2026-10-07-review-feature-plan.md`: spaced-repetition
review ("Anki for my mistakes"). Four new tables. Each holds **user-authored
state that can't be derived from `raw`** (CLAUDE.md's schema rule), so each
earns its place; none copies anything a decision shows.

| Table | What it holds | Why it's stored |
|---|---|---|
| `ReviewCard` | One per `Decision` (`decisionId` unique, FK RESTRICT): the FSRS schedule (`due`, `stability`, `difficulty`, `elapsedDays`, `scheduledDays`, `learningSteps`, `reps`, `lapses`, `state` 0 New / 1 Learning / 2 Review / 3 Relearning, `lastReview`) plus `suspended`. Index `(suspended, due)` for the due queue. | The user's choice to study the decision, and the outcome of their own answers. |
| `ReviewLog` | One row per answer (`cardId` FK **CASCADE**: deleting a card deletes its history): `rating` (1 Again … 4 Easy), `correct`, `chosen` (the option key), `loss`, `stateBefore` (JSON snapshot of the card's schedule, so schedules can be recomputed later), `reviewedAt`, `durationMs`. Indexes `(cardId, reviewedAt)`, `(reviewedAt)` (today's counts). | The user's answer history. |
| `Tag` | `name`, unique, trimmed user text. The table's default case-insensitive collation is kept on purpose: "Prime" and "prime" are one tag. | User text. |
| `DecisionTag` | `(decisionId, tagId)` primary key, `@@index([tagId])`. FK to Decision RESTRICT, to Tag CASCADE. Tags attach to the **decision**, like notes, not to the card. | User text. |

No `utf8mb4_bin` anywhere: no column stores an externally-sourced string
identifier (keys are internal ints; `chosen` is the app's own option key;
`Tag.name` is user text). Migration `20261007200000_add_review_cards_tags`,
whose header says so.

**Cards derive everything from `raw`, through the dispatchers.** A card
stores nothing about the position. The board, dice, cube, options, equities,
labels and match context come from the decision's `raw` through
`lib/analysis/index.ts` (`getDecisionAnalysis`, `decisionLabels`,
`decisionMatchContext`, `decisionRoll`, and the board values via
`lib/decisionFromRow.ts`) each time a card is shown
(`lib/review/cardPayload.ts`). Review code never reads Galaxy's format, and
`raw` is never modified.

**Eligibility** (`lib/review/eligibility.ts`): counted (`countAsDecision`
and `rawError` not null); `kind` CHECKER or CUBE (resignations never); the
match's source has a translator (`hasAnalysisTranslator`);
`getDecisionAnalysis` returns non-null of the matching kind; a checker move
has ≥ 2 candidates (a forced move has nothing to choose). Any player's
decision qualifies.

**Grading** (`lib/review/options.ts`; threshold `CORRECT_LOSS_THRESHOLD` =
0.02 in `lib/settings.ts`, Galaxy's good/error boundary; the edge counts as
correct). The server grades every saved answer itself; the client's grading
is only for showing the back of the card.

- **Checker:** every candidate (3–5, always including the move played),
  shuffled, keyed by its notation. Correct when the candidate's `loss` ≥
  −0.02 (loss against the true best by equity).
- **Cube, doubler** (`role` doubler), fixed order:

  | Option | Key | Doubling part | Take/pass part |
  |---|---|---|---|
  | No Double / Take | `nd_take` | no double | take |
  | Double / Take | `dt` | double | take |
  | Double / Pass | `dp` | double | pass |
  | Too good / Pass | `tg_pass` | no double | pass |
  | Too good / Take | `tg_take` | no double | take |

  Not doubling is worth ND; doubling min(DT, DP). Doubling loss = chosen −
  max of the two. Take is right when DT ≤ DP, pass otherwise; within 0.02 of
  each other either is right. Correct = doubling loss ≥ −0.02 **and** the
  take/pass part right. The loss shown is the doubling loss plus −|DT − DP|
  when the take/pass part is the strictly wrong one. The best option shown
  is `doublerAction`'s (`lib/cubeAction.ts`: too good needs ND > DP
  strictly, DT == ND is No Double, DT == DP is Take). Decision 629849 (ND
  0.7922, DT 0.9751, DP 1): best Double / Take; Double / Pass loses 0.0249
  (wrong); No Double loses 0.1829.

  **Near-ties give more than one correct answer** (accepted by the user,
  2026-10-08). The rule grades the two parts, not the five labels, so:
  - **No Double / Take and Too good / Take always grade the same.** Both
    mean "don't double, the opponent would take".
  - **Too good / Pass and Double / Pass both grade correct when ND is
    within 0.02 of DP and DT > DP** (pass is the right half). Either
    doubling part is then within the threshold of the best, ND == DP
    included.

  The card still shows the single best answer (`doublerAction`'s); only
  the grading accepts the others.
- **Cube, receiver:** Take and Pass. Take right when the doubler-view DT ≤
  DP; the wrong one loses |DT − DP|; correct within 0.02.

A wrong answer is rated **Again** automatically; a right one is rated Hard,
Good or Easy by the user. FSRS is `ts-fsrs` 5 with default parameters,
behind `lib/review/fsrs.ts`. Daily limits, "today" (the server's local day)
and the queue order are in `lib/settings.ts` and `lib/review/queue.ts`.

**Review history is a deliberate record** (2026-10-08). Some `ReviewLog`
columns are stored though nothing reads them yet:

- `correct`, `loss` and `durationMs` record what the user was shown and did
  at review time.
- `correct` and `loss` could be recomputed from `chosen` plus the
  decision's `raw`. They're kept as a snapshot because the grading rules
  (the threshold, the cube rule above) can change, and the history can't
  be rebuilt after the fact under the rules that applied then.
- `durationMs` can't be derived at all.
- `ReviewCard.createdAt`/`updatedAt` are standard audit timestamps.

## PlayerIdentity

Covers **both** you and your opponents — a lookup/reference table keyed by
`(source, sourceUserId)`, not a replacement for the raw `userId` string
column on `Decision`, which stays exactly as it is.

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
