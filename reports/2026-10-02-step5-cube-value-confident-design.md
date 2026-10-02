# Step 5 proposal: cube value + confident as real `Decision` columns

Status: proposal + implementation in the same pass, scope already settled by explicit user choice (see below).

## Scope (as decided)

The investigation above (not repeated here — see chat) found `computeCubeStates`' `confident` flag is false for ~21% of real decisions, mostly because `double_accepted`/`double_rejected` events are frequently stored with a null `error_analysis` and silently dropped (never becoming their own `Decision` row), so the DB-row-only read path can never see that a double was actually resolved. Ingest-time computation, operating on the full live event stream before any row is filtered out, would fix roughly half of these retroactively for *new* ingests — but not for already-ingested historical data, since the backfill script (no live Galaxy calls, per the established constraint) can only ever see what's already stored.

Given the choice between (a) a full fix including re-ingesting historical data live, (b) ingest-time fix only with a DB-rows-only backfill (same `confident` limitation as today for historical data), or (c) value-only with no `confident` change at all — **option (b) was chosen**: compute `value`/`confident` at ingest time (fixes new data automatically going forward), backfill from stored rows only (same ~21% false-unconfident rate persists for historical data until it's naturally re-ingested).

## Column design

```prisma
cubeValue     Int?
cubeConfident Boolean?
```

Both nullable for migration-sequencing only (same reasoning as `plyNumber`/`sourcePositionId`/`roll` — every row with a review always gets a real computed value from `computeCubeStates`, no legitimate "N/A" case exists). No collation concern (not string identifiers), no index (display-only, never filtered/sorted/queried — same performance profile as `roll`).

**`cubeOwnerUserId` is not a new column** — it already exists, but today is populated only for `CUBE`-kind rows (`kind === DecisionKind.CUBE ? cubeOwner : null`). This step widens its population to every kind (so `CHECKER`/`RESIGNATION` rows get a real owner too, matching what `computeCubeStates` already computes for every row today at read time) — a population-rule change plus a backfill, not a schema change.

## Computation — reuse, don't reimplement

`computeCubeStates(events)` is called once per game (same precompute-once-per-game shape as `rollByEventId`/`checkerPlyByEventId`), and its `.value`/`.confident` are read off directly for each event. **Not** modified to also expose an absolute owner (which would mean adding a field to the public `CubeState` interface) — `lib/cubeState.test.ts` has ~10 exhaustive `.toEqual({ value, owner, confident })` assertions that a new field would break for no real benefit, so `lib/cubeState.ts` and its tests are untouched entirely.

Instead, `lib/ingest.ts` keeps its own existing absolute-owner walk (`cubeOwner`, unchanged logic) for `cubeOwnerUserId`, just un-gated from `kind === CUBE`. Verified directly — not assumed — that this independent walk and `computeCubeStates`' own internal (relativized) owner never disagree: **0 mismatches across all 1,257,534 rows in all 15,640 games**, converting `computeCubeStates`' relative `owner` back to absolute via each event's own `user_id` and comparing. Both walks use the identical update condition (`analysed_event === "cube_pass" && review.take === true`) over the identical event sequence, so this is a structural guarantee, not a coincidence — confirmed anyway per this project's "verify before switching" convention.

## Backfill

Per-game-chunked (same reasoning as `roll`'s backfill — cube state needs the full in-game event sequence, not a single row's own JSON). Measured real cardinality: **1,986 distinct `(cubeOwnerUserId, cubeValue, cubeConfident)` tuples** across the whole table — between `roll`'s 36 and `sourcePositionId`'s 609k, but still globally batchable (accumulate ids per tuple across all game-batches in memory — ~2,000 small arrays, cheap — then one `updateMany` per distinct tuple at the end, same shape as `roll`'s script). Idempotent via value comparison against each row's current state (not a `WHERE ... IS NULL` pre-filter — same reasoning as `roll`'s script, though in practice every pre-existing row's current value actually is `null` here since this is a wholly new computation, unlike `roll`'s partial-overlap case).
