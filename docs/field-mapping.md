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
`PlayerIdentity.sourceUserId`, `Decision.userId`, `Decision.cubeOwnerUserId`,
`RepeatedPosition.sourcePositionId`, `Decision.sourcePositionId`.

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
| `prisma` (read-write) | `lib/ingest.ts`, `lib/sync.ts`, `scripts/backfill.ts`, `scripts/incremental-sync.ts`, `scripts/runSyncCli.ts`, `/api/sync/incremental`, `app/api/galaxy/matches/list/[page]/route.ts` (writes the `isMe` `PlayerIdentity` row), `prisma/seed.ts`, `scripts/backfill-opponent-identities.ts`, `app/api/decisions/[id]/note/route.ts` (saves/clears a `DecisionNote`), `scripts/notes-import.ts` |
| `prismaReadOnly` (read-only) | `lib/local-client.ts` (the `/matches` DB-backed read path — and everything that routes through it: `/api/matches/list/[page]`, `/api/matches/[matchId]/[gameIndex]`), `app/api/player-identities/route.ts`, `app/status/page.tsx`, `app/api/decision-notes/route.ts` (`/matches/[matchId]`'s per-match note lookup; `/galaxy/matches/[matchId]` never calls it), `scripts/notes-export.ts` |

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
| `matchLength` | The match length in the GNU Match ID (`reviews[0].source_match.formatted_value`) of the match's first decision — lowest `gameIndex`, then lowest `eventId`. **0 = money game**, and an **even decoded length is stored as 0 too** (Galaxy matches are always odd; since 2026-10-07, see "Even lengths are money" below). See "GNU Match ID" below. Since 2026-10-06; before that it was `metadata.match_length`, which is null on Galaxy's older analyses (2,182 local match-play matches had no length). About 30 single-game matches' Match IDs flip from 0 to 1 after a double; they store the first decision's 0, per the user. Null only until detail-ingested, or for a match with no stored decision at all (1 locally, match `6029642`). |
| `playedAt` | The `Game.playedAt` of the match's first game (lowest `gameIndex`) that has one — see "playedAt: what it actually means" below. Null until then — distinct from `createdAt`. |
| `createdAt` | DB default (`now()`), set when the row is first created — i.e. when the match was first ingested, not when it was played. |

## Game

| Column | Origin |
|---|---|
| `id` | Internal auto-increment key. |
| `matchId` | FK to `Match.id` (the internal key, not `sourceMatchId`). |
| `gameIndex` | The loop index used to fetch `game_reviews/{matchId}/{gameIndex}` (starts at 1). |
| `playedAt` | `metadata.timestamp` of this game's first decision **by eventId** (not earliest timestamp value) with a populated `error_analysis`. Null until detail-ingested — see below. |
| `userScore`/`opponentScore` | The score entering this specific game (not the match's current/final score — that's `Match.userScore`/`opponentScore`, from the separate `analyses/list` endpoint). Decoded from the GNU Match ID of the game's first decision by `eventId`, through the user's own seat (`PlayerIdentity.isMe`; black = player 1, white = player 0). Null for a money game (`Match.matchLength` 0, including an even decoded length). See "`userScore`/`opponentScore`/`crawfordState`" below. |
| `crawfordState` | `"crawford"`, `"post_crawford"` or `"none"` (Galaxy's own `metadata.crawford_state` vocabulary), derived from the same Match ID: the Crawford bit, plus scores and length for post-Crawford. Null for a money game. See below. |

### `userScore`/`opponentScore`/`crawfordState`

**Since 2026-10-06** all three come from the GNU Match ID (see "GNU Match ID"
below) of the game's first stored decision by `eventId`
(`lib/gnuMatchId.ts`'s `gameScoreFromMatchId`, shared by `lib/ingest.ts` and
`scripts/backfill-game-scores-from-match-id.ts`):

- **Scores:** the Match ID holds absolute scores per GNU player.
  `userScore` is the score of the user's seat (`PlayerIdentity.isMe` →
  black = player 1, white = player 0) and `opponentScore` the other seat's.
  Seats are resolved per match from the match's own decisions (each row's
  `color` where Galaxy filled it in, else the Match ID's dice owner for a
  move or turn for a cube decision — `addSeatEvidence`). If the user's seat
  can't be resolved, the scores are left as they were (56 local games, all
  in single-row matches with no seat evidence).
- **`crawfordState`:** `"crawford"` when the Match ID's Crawford bit is set,
  `"post_crawford"` when it isn't but a player is 1-away, `"none"`
  otherwise. Matches Galaxy's own label on every local game of length 2+
  (7,471 of 7,471; an earlier "7,531" also counted the 60 money games,
  which agree too). For a 1-point match it's `"none"`: Galaxy changed its
  own label there over time (`"crawford"` on 60 old games up to match
  `40136106`, `"none"` from `40310886` on), with the Crawford bit clear in
  both, so the new rule follows Galaxy's current behaviour.
- **Money game** (Match ID length 0, or an even decoded length — see
  "Even lengths are money" below): all three null, as before.

**Why it changed.** Before 2026-10-06 these came from `metadata.scores` of
the game's first event with non-null scores, read as "`black` = the actor,
`white` = their opponent". That was wrong: **`metadata.scores.white` is the
score of the player on roll, and `black` the other player's.** It isn't keyed
by colour or by actor. Ingest happened to read the opponent's first move on
about half of all games, which swapped the two scores. The user confirmed it
on Galaxy (match `47816592` game 4 starts opp 4 – user 2, stored the other
way round; `45282503` game 2 starts user 1 – opp 0, stored 0 – 1). Decoding
the Match ID with the user's colour gives 0 inconsistencies across 1,965
matches; a plain swap still leaves 2 wrong (`33002925` g3, `33013316` g6,
where Galaxy's `metadata.scores` orientation is itself anomalous). Also,
`metadata.scores`/`match_length` are null on Galaxy's older analyses (about
7,885 local games), which left those games without a score; the Match ID
has it.

Local checks after the backfill (2026-10-06): no match-play game's entering
score exceeds the match's final `Match.userScore`/`opponentScore` (0), and
no score goes down between consecutive games (0).

The old `Decision.matchScoreBlack`/`matchScoreWhite`/`crawfordState`
columns were dropped 2026-10-02 (`reports/2026-10-02-raw-field-
reverification.md`); the deleted `scripts/backfill-game-score-crawford.ts`
implemented the old actor-relative reading.

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

So an even decoded length means money: `Match.matchLength` 0, and
`Game.userScore`/`opponentScore`/`crawfordState` null, exactly like length
0. `decodeGnuMatchId` still returns the literal bits; the rule lives in one
helper, `lib/gnuMatchId.ts`'s `effectiveMatchLength`, used by ingest,
`gameScoreFromMatchId`, `crawfordStateFor` and
`scripts/backfill-game-scores-from-match-id.ts`. No display path reads the
length (the live and DB paths only read the cube from the Match ID).

**Player 1 = black, player 0 = white.** Verified on every local CHECKER row
(595,845): `Decision.color` always equals the dice owner's colour. The
decision's actor is the dice owner on a move, and the turn on a cube
decision (`cube_double`: 663,169 rows; `cube_pass`: 6,999 rows, where the
double-offered bit is set and the turn is the receiver). Resignations don't
follow either rule reliably (actor ≠ turn on 70 of 1,893 checkable rows), so
they aren't used as seat evidence.

**Evidence it's right:** the decoded length equals `metadata.match_length`
on every row where that's set; the decoded cube agrees with every row the
retired take-walk marked `cubeConfident = 1` except 27 (one game, see
`Decision.cubeValue` below; since corrected to the Match ID); every one of the 1,268,047 local Decision rows
decodes; and the user confirmed the cube on Galaxy's site in 5 cases
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
`Game`/`Match.playedAt` to the rule above (re-derived from stored
`Decision.raw` JSON, no live Galaxy calls) — useful for keeping stored
values self-consistent with `lib/ingest.ts`'s current rule if that rule
ever changes again, but it does not and cannot fix the historical backfill's
fundamentally wrong dates, for the reason above.

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
| ~~`isBlunder`~~ | **Dropped 2026-10-02** (`reports/2026-10-02-raw-field-reverification.md`) — confirmed 100% redundant with `errorSeverity === 'BLUNDER'` (0 mismatches across 371 real rows checked) and never read anywhere (write-only). Use `errorSeverity` instead. |
| `luck` | `error_analysis.luck` |
| `luckMwc` | `error_analysis.luck_mwc` |
| `equity` | `result.result.equity` (the decision-level equity, not a per-candidate-move one). |
| `mwc` | `probabilities.mwc`, but only when `probabilities.mwc_context` is non-null — forced to `null` otherwise. |
| `classification` | **`review.source_position.classification` only — never `destination_position`.** The analysis is about the quality of a decision made *at* a position, so the phase that matters is the board state before the move (source), not after (destination); falling back to destination would silently mislabel the decision's phase. If `source_position`/`.classification` is ever actually missing, ingest throws for that one decision (caught, recorded in the ingest summary's `errors`) rather than silently substituting destination. |
| `sourcePositionId` | `review.source_position.formatted_value` (the GNU Position ID of the board *before* this decision — same source object `classification` reads from, just not hard-failing if missing). Added as a real column (previously re-parsed from `raw` on every read) specifically to replace two unindexed `JSON_EXTRACT` call sites — see `findPositionOccurrences` (`lib/decisionQueries.ts`) and "Collation for externally-sourced identifiers" above, and `reports/2026-10-02-step3-sourcepositionid-column-design.md` for the full before/after measurements (unforced ~28.4s / `FORCE INDEX`-forced ~21.2s / new column+index ~0.3s, same real worst-case literal). Confirmed 100% real-data coverage; nullable only for migration-sequencing reasons, same as `plyNumber`. |
| `plyNumber` | Not in the payload directly — computed at ingest from `eventId` order alone (see "Ply number" below). `1`-`4` for a game's first four `CHECKER` decisions (by `eventId` ascending), `null` beyond that and always `null` for `CUBE`/`RESIGNATION` kind. |
| `roll` | Not in the payload directly on *this* event — computed at ingest by walking the game's full event list backward from this one for the nearest preceding `dice_rolled`/`game_started` event's own `rolled_dice` (a checker's own `move_commited` event never carries its roll). Added as a real `Json?` column (previously re-scanned on every read via a now-removed `buildRollLookup`) — see `reports/2026-10-02-step4-dice-roll-column-design.md`. Null for ~2.52% of rows at the time the column was added, in three categories: a game's genuinely first decision; a `dice_rolled` event's own cube-check review (the scan looks past its own roll by design — a real, deliberately-unfixed pre-existing display quirk, not a data gap); a `RESIGNATION`/`CUBE` decision with no roll associated at all. **The first category was subsequently fixed** (2026-10-02, same day) — independently verified against Galaxy's live site that this was recoverable, not a genuine gap, and backfilled from each row's own already-stored `raw.moves` field via `lib/mistakes.ts`'s `decodeRollFromMoves` + `scripts/backfill-first-move-roll.ts` (100% reliable for a game's first move specifically — bear-off/bar-entry, which break this decode method in general, can't occur there). The other two categories remain null by design, unchanged. |
| ~~`matchScoreBlack`~~ / ~~`matchScoreWhite`~~ / ~~`crawfordState`~~ | **Dropped 2026-10-02** (`reports/2026-10-02-raw-field-reverification.md`) — confirmed write-only (never read anywhere) and, worse, confirmed unreliable at this per-decision granularity: a subset of events in a game report `metadata.scores` as null while sibling events in the same game report the real value — the earlier claim here that `scores`/`match_length` are null "consistently across every decision" in a money-game match was true for that one case checked, but wrong as a general rule once more matches were checked. Replaced by `Game.userScore`/`opponentScore`/`crawfordState` — one resolved, actor-relative value per game instead of an unreliable value per decision. See `docs/field-mapping.md`'s `Game` section ("`userScore`/`opponentScore`/`crawfordState`: resolution and the bug they fixed") for the full story. |
| `cubeOwnerUserId` | The userId in the GNU Match ID's cube-owner seat (see "GNU Match ID" above), null when centred — who owned the cube *entering* this decision. Every kind. Seats resolve per match exactly as for `Game.userScore`. **Since 2026-10-06**; before that a walk over each game's takes, retired (see below). |
| `cubeValue`/`cubeConfident` | `cubeValue` is the GNU Match ID's cube value entering this decision (1 = centred). **`cubeConfident` is now always true when the Match ID decodes and its owner seat maps to a userId**; false (with `cubeValue`/`cubeOwnerUserId` null, and an ingest warning) only if that ever fails — the backfill dry run found no such local row (0 undecodable, 0 unmapped owners). Kept as a column so that case stays visible. **Since 2026-10-06.** Before that both came from `lib/cubeState.ts`'s `computeCubeStates`, a walk over each game's `cube_pass` takes, which missed takes on ~21.9% of rows (the take events are often stored with a null `error_analysis` and skipped) and flagged them `cubeConfident = false` (drawn with no cube). The walk is retired. Backfill: `scripts/backfill-decision-cube-from-match-id.ts` (replaces the deleted walk-based `scripts/backfill-decision-cube-state.ts`). Its 2026-10-06 local dry run found 27 `cubeConfident = 1` rows that would change — all of match `46000168` game 4, where the Match ID says a 2-cube from the first stored row on and the walk saw no take (the first stored eventId comes well after game 3's last); the user won that game for exactly 2 points, and the start of the game is missing from Galaxy's stored events, so the Match ID is very likely right. On 2026-10-07, with the user's approval, the local run applied them (`--accept-confident-changes=27`, after a read-only SQL check that the confident rows disagreeing with the Match ID were exactly ids 1172684–1172710) together with the 275,336 `cubeConfident = 0` rows; every local row is now `cubeConfident = 1` (1,268,047). **Board side:** the board draws the position's on-roll player (the Match ID's dice owner) at the bottom, so the cube is drawn relative to that player, not the decision's actor — on a `cube_pass` row the stored position is the doubler's (6,997 of 6,999 local rows share the preceding `cube_double` row's position ID), so the receiver is at the top. `lib/decisionFromRow.ts`'s `cubeStateFor` / `lib/cubeState.ts`'s `cubeStateFromMatchId`. |
| `movePlayed` | For `CHECKER` kind: the candidate move with `move_played: true`. Null for `CUBE`/`RESIGNATION` kind. **Renamed from `notationPlayed` 2026-10-02** (`reports/2026-10-02-raw-field-reverification.md`) for parallel naming with `cubeActionPlayed`/`cubeActionBest` below — same values, same derivation, name only (the rename migration preserved all existing data via `CHANGE COLUMN`, not a drop+recreate). |
| `moveBest` | For `CHECKER` kind: the candidate move with `rank === 1` (falls back to the first move if none has rank 1). Null for `CUBE`/`RESIGNATION` kind. Renamed from `notationBest`, same as `movePlayed` above. |
| `cubeActionPlayed`/`cubeActionBest` | For `CUBE` kind only (`analysed_event` exactly `"cube_double"` or `"cube_pass"` — never a fallback/else): the same `mine`/`best` short labels `lib/mistakes.ts`'s `actionLabels()` computes (e.g. `"doubled"`/`"double"`), stored once at ingest. **`cubeActionBest` stays Galaxy's own label; the app no longer displays it as "best"** — since 2026-10-06 the displayed best is derived from the equities (see "Cube action from the equities" below), and `cubeActionBest` is shown only in the "Doesn't match Galaxy" badge's tooltip when the two disagree. **Replaces the old `cubeDetail` column** (a single composed display string, confirmed 2026-10-02 never rendered anywhere) with a column pair parallel to `movePlayed`/`moveBest`. `RESIGNATION` kind's own labels deliberately excluded from this treatment — stays read-time-computed via `actionLabels()`, no column (a scope decision, not an oversight). Null for `CHECKER`/`RESIGNATION` kind. |
| `resignError` | For `RESIGNATION` kind: `result.result.resign_error`. Null otherwise. |
| `shouldResign` | For `RESIGNATION` kind: `result.result.should_resign`. Null otherwise. |
| `resignationType` | For `RESIGNATION` kind: `result.result.resignation_type` — **confirmed nullable even for `RESIGNATION` rows**, not just absent for other kinds (seen `null` on a real blunder-severity resignation, match `2856675` event `440889365`). Null for other kinds too. |
| `equityBefore` | For `RESIGNATION` kind: `result.result.equity_before` — same nullability note as `resignationType`. Null for other kinds too. |
| `equityAfter` | For `RESIGNATION` kind: `result.result.equity_after` — same nullability note as `resignationType`. Null for other kinds too. |
| `timestamp` | `metadata.timestamp` |
| `myTag` | No source field yet — always `null`. |
| `raw` | The complete original `event` object (not just `reviews[0]`) — the zero-blind-spot archive `getGameReviews` reconstructs a game's events array from. |

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

The general fields (`rawError`, `errorSeverity`, `luck`, `luckMwc`,
`equity`, `mwc`, `classification`, `timestamp`) come from
`error_analysis`/`metadata`/`probabilities`, same as every other kind —
no special-casing needed there.
Only the cube-specific (`cubeActionPlayed`/`cubeActionBest`) and
resignation-specific (`resignError`/`shouldResign`/`resignationType`/
`equityBefore`/`equityAfter`) fields are kind-gated.

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
`no_double`, DT = `double_take`, DP = `double_pass`):

| ND | DT | Correct action |
|---|---|---|
| < DP | ≤ DP | Double/take if DT > ND, otherwise No double/take |
| < DP | > DP | Double/pass |
| ≥ DP | > DP | Too good/pass |
| ≥ DP | ≤ DP | Too good/take |

Tie rules: DT == ND (both < DP) → No double/take; ND == DP → the "too good"
branch; DT == DP → the take side.

The code compares against DP rather than a literal 1. **DP is 1 on every
counted `cube_double` row** locally; it differs (0.18–0.91) only on 89,593
uncounted pre-roll checks, which the app doesn't show.

**The receiver's decision** (`cube_pass` rows): the stored values are the
doubler's negated (DP = −1), so "take if −DT ≤ −DP" — i.e. take if the
doubler-view DT ≤ DP, pass otherwise. 4 local `cube_pass` rows (matches
`33002925`, `33013316`) aren't negated (DP = +1); multiplying by the sign of
DP handles both. The derived action is "Take" or "Pass".

**"Doesn't match Galaxy":** `doublers_best_action` "roll" corresponds to
No double/take, Too good/pass and Too good/take; "double" to Double/take and
Double/pass. Where `receivers_best_action` is set it must also agree: "take"
with No double/take, Double/take, Too good/take (and Take); "pass" with
Double/pass, Too good/pass (and Pass). `cube_pass` rows compare against
`receivers_best_action` only.

**Exact ties count as matching** (since 2026-10-07; about 324 counted local
rows). A disagreement caused only by a tie isn't a mismatch — exact
equality on the stored numbers, as the tie rules above use:

- **ND == DP:** too good and double are equal, so "roll" and "double" both
  match on the doubling part (e.g. decision `662455`, match `33173703` g2:
  ND = DP = 1, DT 2.83, Galaxy "double, pass"; the user doubled for 0
  error). The take/pass part is still checked: "pass" matches here.
- **DT == ND** (both below DP): double and no double are equal, so both
  match (e.g. `1020878`, `42234245` g2: ND = DT = 0.5242, Galaxy "double,
  take").
- **DT == DP:** take and pass are equal, so both match (e.g. `1228774`,
  `33887678` g4: ND 0.7293, DT = DP = 1, Galaxy "double, pass"). Applies to
  `cube_pass` rows too.

Only the badge changes; the derived action keeps the tie rules above (so
`662455` still shows Too good/pass as best). When they disagree, the UI shows the derived
action as "best" plus a small "Doesn't match Galaxy" badge with Galaxy's own
label in its tooltip (`GalaxyMismatchBadge`, on /mistakes, the replay,
/matches and /galaxy — `lib/mistakes.ts`'s `displayLabels`, used by both
`extractDecisions` and `lib/decisionFromRow.ts`). On /galaxy this is a
display computation over Galaxy's own data, not stored user data.

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
doesn't actually exist. Since 2026-10-06 the signal is `Match.matchLength =
0` (the GNU Match ID's own money-game encoding, see "GNU Match ID"), with
`Game.userScore/opponentScore` null for those games; a real category flag can
be added later if it's ever needed.

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
