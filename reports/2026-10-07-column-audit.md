# Column audit: Decision, Game, Match (2026-10-07)

The investigator ran this audit against the local DB and code. It applies the CLAUDE.md "columns must earn their place" rule: a value is kept as a column only if SQL filters, sorts, groups or counts by it, if deriving it needs other rows, or if a view shows many rows without loading `raw`.

## Decision: keep
These are used in SQL, are keys, or are `raw` itself:
- `id`, `gameId`, `eventId`
- `userId`
- `kind`: in two indexes, filtered on /mistakes and by `findPositionOccurrences`, and grouped into `MistakeStat`
- `countAsDecision`, `rawError`, `errorSeverity`
- `classification`
- `plyNumber`: also needs other rows (the game's order)
- `sourcePositionId`
- `raw`

## Decision: candidates to drop (about 108 MB of values; mainly a design win)
| Column(s) | Why it can go | Replacement |
|---|---|---|
| `luck`, `luckMwc`, `equity`, `mwc`, the 5 resignation columns, `myTag` | Written but never read (`myTag` is always null) | none needed |
| `cubeValue`, `cubeOwnerUserId`, `cubeConfident` | Exactly derivable from the row's own Match ID (100% on 1.27M rows). `cubeOwnerUserId` is never read. | `decodeGnuMatchId` |
| `roll` | For CHECKER rows, the Match ID dice bits give the roll. They agree on 595,621 of 595,845 rows. On the other **224** rows the stored roll is **wrong**; the Match ID dice match the move played. | Match ID dice (fixes those 224 rows) |
| `movePlayed`, `moveBest` | Display only; reproduce from the candidates (56,390 of 56,390 rows in a sample) | the translator |
| `cubeActionPlayed`, `cubeActionBest` | Display only; `actionLabels(review)` already gives the same | `actionLabels` / `cubeAction` |
| `analysedEvent` | No SQL and no app read; only two backfill scripts use it | read from `raw` inside the translator |
| `color` | Equals `raw.color` on every row; no SQL; blank on cube rows | from `raw` |
| `timestamp` | Galaxy's serve time. The /matches DB path sorts a game's rows by it, and that order differs from `eventId` on 116,682 rows in 10,769 games, which is likely a latent ordering bug. | sort by `eventId`, then drop |

## The user's three claims
- **(a) `countAsDecision` vs severity:** not redundant. Every severity occurs both counted and uncounted, so keep `countAsDecision`.
- **(b) `kind` vs `analysedEvent`:** `kind` is a function of `analysedEvent`, but not the reverse. `kind` is the one used in SQL, so it stays and `analysedEvent` goes.
- **(c) `color`:** can be derived per row from `raw`, so drop it.

## Game and Match
- **`Game.userScore`, `opponentScore`, `crawfordState`, `playedAt`:** no app reads them; only backfill scripts do. Each decision's own Match ID already carries the current score, Crawford flag and length, so a per-decision display doesn't need them. `Match.playedAt`, which is displayed, is computed at ingest.
- **`Match.matchLength`:** no app reads it, and it's derivable from the Match ID.
- **Keep the `/matches` list fields on Match** (`opponentName`, `opponentRating`, `userScore`, `opponentScore`, `userError`, `opponentError`, `playedAt`, `opponentCountry`, `userRating`). They come from Galaxy's list endpoint, not from `raw`, and the list is shown without loading `raw`.
- **Keep `ingestStatus`:** sync filters on it.
- **`ingestError`:** written but never read. It's an operational log; dropping it is optional.

## Doc correction
"1,367 of them a rank-4/5 candidate" means: on 1,367 of the 2,188 rows, the **best** candidate is rank 4 or 5. The rest are rank 3 (686) and rank 2 (135).

## Galaxy-specific columns we keep
`classification`, `countAsDecision`, `errorSeverity` and `sourcePositionId` are Galaxy or GNU concepts. A second source would have to map onto them. This isn't urgent.
