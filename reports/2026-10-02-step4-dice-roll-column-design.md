# Step 4 proposal: dice roll as a real `Decision` column

Status: proposal + implementation in the same pass (per explicit instruction — Step 3's propose-then-implement reasoning already validated end-to-end, no separate approval pause required unless something here is genuinely novel). One finding below is genuinely novel and corrects a wrong first-draft belief of my own (not just the ask's framing) — reported prominently rather than silently absorbed — but it doesn't block a sound design; if anything it simplifies the design back to exactly what the ask originally described.

## 1. Column type / nullability / cardinality

**Cardinality is low, like `plyNumber` — not like `sourcePositionId`.** Measured directly: 36 distinct non-empty `rolled_dice` values across the whole table (ordered pairs, 6×6 — matches the domain exactly), plus `null`. This settles the backfill-shape question up front: no OOM risk from output cardinality, batched `updateMany` grouped by distinct value is cheap (~37 calls total, not ~609k like `sourcePositionId`'s wrong-shape first attempt).

**But cardinality isn't the only axis that mattered last time** — the OOM in Step 3 came from materializing *input* (`raw` JSON) for the whole table in one query, not from the output grouping. Dice roll's extraction is **structurally different from `sourcePositionId`'s**: it requires scanning *sibling rows within the same game*, not just the row's own JSON — so it can't be done with a single-row `JSON_EXTRACT` or a single server-side `UPDATE` statement at all (no window-function equivalent of "nearest preceding non-empty `rolled_dice`, else this row's own" was worth building when this project's own established pattern already does exactly this kind of cross-row logic in JS — see `plyNumber`'s and `playedAt`'s backfill scripts). So: low-cardinality *output* (batch by value, like `plyNumber`), but **per-game-chunked input** (like `playedAt`'s per-match iteration, not a single flat `findMany` over the whole table) — bounded memory regardless of total row count, for a different reason than cardinality.

**Column**: `roll Json?` — nullable JSON array (e.g. `[6,2]`), matching `Decision.roll`'s existing app-level shape (`number[]`) with zero transform needed beyond the same `?? []` fallback already used everywhere. No collation concern (not a string identifier). No index — never filtered/sorted/queried, only displayed (confirmed in the original audit; the performance case for this field was always about avoiding sibling-row over-fetch at read time, not query speed).

## 2. Extraction logic — matches `findPrecedingRoll` exactly, as asked (with one real bug found along the way)

The ask's framing is correct as stated: "same `event_type ∈ {dice_rolled, game_started}` rule, same `.rolled_dice` read." I initially second-guessed this, believing `decisionFromRow`/`decisionFromRowForReplay`'s `rollLookup.get(key) ?? event.rolled_dice ?? []` expression meant the backward scan had a live "fall back to this row's own `rolled_dice`" behavior that needed replicating too. **That belief was wrong, and worth stating plainly rather than quietly correcting**: `rollLookup.get(key)` is *always* a defined value (`buildRollLookup` sets every row's key, even to `[]`) — and `[] ?? x` evaluates to `[]` in JavaScript, not `x` (confirmed directly: `?? ` only treats `null`/`undefined` as the trigger, never an empty-but-defined array). So **that fallback is dead code today** — the DB-row path's real, current output is just `findPrecedingRoll(events, index)`, unconditionally, exactly as the ask originally described. Verified this is the literal behavior, not an assumption.

One consequence worth flagging (found while chasing this down, not asked for, **not fixed here**): because the fallback never fires, a `dice_rolled` event's *own* Decision row (reviewed as a "should you have doubled before this roll" cube check) never shows its own roll via the DB-row path today — the backward scan looks *past* it for an older roll, finds nothing if this is an early roll in the stored sequence, and the dead `?? event.rolled_dice` never rescues it. This is a small, pre-existing display quirk (CUBE-kind rows under-display their own roll), independent of and not touched by this step — replicating it faithfully is exactly what "ingest-time values will match what every current read path already computes" calls for. Flagged here for visibility (same spirit as the audit's own cross-cutting findings), not silently fixed as a drive-by.

**Formula, confirmed correct**:
```
roll = findPrecedingRoll(events, index)
null if empty, else the array
```
Applied unconditionally for every kind (not gated to `CHECKER`) — matching `buildRollLookup`'s real current behavior (which the DB-row paths use), not `extractDecisions`'s `kind === "checker" ? ... : []` gating. That kind-gating difference between the two paths is itself a separate, real, pre-existing divergence (same category as the severity bug Step 2 fixed) — also flagged, also not fixed here, since the ask is about relocating computation, not reconciling the two paths' semantics. `extractDecisions` (the live-fetch path, `lib/mistakes.ts`) is untouched either way: no DB row to read a column from, same established reasoning as Steps 1/2.

## 3. Expected null rate — the stated assumption needs one correction

Measured directly against real data, using the confirmed-correct formula above (no fallback):

| Measurement | Count | % of 1,257,534 rows |
|---|---|---|
| Null (`findPrecedingRoll` alone — the real, current value) | **31,639** | **2.52%** |
| …of which: game's genuinely first stored decision | 15,635 | — |
| …of which: a `dice_rolled` event's own cube-check row (the dead-fallback quirk above — its own roll exists but the backward scan can't see it) | 15,441 | — |
| …of which: genuinely no roll associated at all (`RESIGNATION`/`CUBE` decisions where neither a preceding roll nor the row's own carries one) | 563 | — |

So the "null only for a game's genuinely first move" premise needs a correction: that's true for exactly half of the null rows (15,635 of 31,639). The other half (15,441) are the dead-fallback CUBE-review quirk just described — a real category, not a bug in the new column, just an accurate replication of what's already displayed (or rather, not displayed) today. A residual 563 (inspected 6 concrete real examples directly) are genuine `RESIGNATION`-right-after-a-move or `CUBE`-double-before-rolling-again cases with no roll to show at all — a third, smaller, also-legitimate "not applicable" category.

**One more structural caveat, unmeasurable from stored data**: `game_started` events are never stored as their own `Decision` row (confirmed: 0 such rows anywhere in the table) — but `findPrecedingRoll`'s `game_started` branch exists because Galaxy's raw event stream *can* include one with a real `rolled_dice` (seen directly in `lib/__fixtures__/galaxy-payloads/game-started-game-over.json`'s own fixture data: `rolled_dice: [5,2]` on a `game_started` event). Ingest-time computation (operating on the full live event array, before any row is filtered out) will correctly pick this up if present; the **backfill script, restricted to already-stored `Decision` rows only, structurally cannot** — a first move whose roll depended on `game_started` would backfill as `null` even if ingest-time would have correctly captured it. How often this actually happens in practice is unmeasurable from the DB alone (the information was never persisted), so I'm reporting it as a known, accepted limitation rather than chasing it further — same category as `backfill-played-at.ts`'s own documented "first decision with a populated error_analysis" fallback uncertainty.

## 4. Backfill script shape

Per-game-chunked (bounded memory, following `backfill-played-at.ts`'s per-match iteration — not a single flat batch over the whole table), accumulating a **global** `Map<string, number[]>` keyed by the JSON-stringified roll value across all chunks (safe to hold in full: at most 37 keys regardless of table size, each holding an array of row ids), then issuing one `updateMany` per distinct value at the end — mirroring `backfill-ply-number.ts`'s bucket-then-batch-write shape exactly, just reading `raw` per game-chunk instead of a few scalar columns. `--dry-run`, before/after counts, and idempotency (only touching rows where `roll` is still unset) carried over from the established pattern.

Not a single server-side `UPDATE` this time (unlike `sourcePositionId`) — that approach specifically worked there because the value was a pure function of the row's own `raw`; dice roll depends on sibling rows in the same game, which SQL can't express as cleanly as the already-proven JS cross-row walk this project uses elsewhere.
