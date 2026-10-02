# Step 3 proposal: `sourcePositionId` as a real `Decision` column

Status: **proposal only — nothing in this report has been implemented.** No schema, migration, or backfill-script file has been created or modified. This is the design for review requested before Step 3 begins.

Scope: addresses the 4-part request — column definition, index design (with EXPLAIN-grounded reasoning), whether `FORCE INDEX`/the dropped-`GROUP BY` workaround can be retired, and backfill-script shape/scope.

## 1. Column definition

```prisma
sourcePositionId String? @db.VarChar(191)
```

Migration SQL (hand-added, matching the `RepeatedPosition` precedent exactly):

```sql
ALTER TABLE `Decision` ADD COLUMN `sourcePositionId` VARCHAR(191) NULL COLLATE utf8mb4_bin;
-- Externally-sourced identifier (GNU Position ID, from Galaxy's
-- source_position.formatted_value) — pinned to utf8mb4_bin per
-- docs/field-mapping.md, same reasoning and exact collation as
-- RepeatedPosition.sourcePositionId (prisma/migrations/20260926153758_add_repeated_position).
-- Prisma's schema DSL has no MySQL collation attribute; this must be
-- re-added by hand if this column definition is ever regenerated.
```

**Nullable, not `NOT NULL`** — this is the one deliberate difference from the `RepeatedPosition` precedent (which is `NOT NULL`), and it's a migration-sequencing necessity, not a reliability concern:

- `RepeatedPosition` rows are only ever created already-populated (by `recompute-repeated-positions.ts`), so `NOT NULL` is enforceable at write time.
- `Decision` already has 1,257,534 existing rows at the moment this column would be added. `ADD COLUMN ... NOT NULL` with no default would fail outright; backfilling 1.2M+ rows atomically inside the same migration isn't this project's established pattern (see `plyNumber`, `cubeOwnerUserId` — both nullable columns backfilled by a separate script after the migration lands).
- Real-data coverage is confirmed 100% today regardless: `SELECT COUNT(*) FROM Decision` = 1,257,534; rows with a null `source_position.formatted_value` = 0; rows with no `reviews[0]` at all = 0. Every row has this value in `raw` already — the type stays nullable the same way `plyNumber`'s does, as a defensive/sequencing default rather than a reflection of a real data gap.
- Max observed value length: 14 characters — `VARCHAR(191)` is unchanged from the `RepeatedPosition` precedent and has ample headroom.

## 2. Index design

### The query patterns it needs to serve

**`findPositionOccurrences`** (`lib/decisionQueries.ts:68-84`), the primary consumer — exact current query:

```sql
SELECT id FROM Decision
FORCE INDEX (Decision_countAsDecision_rawError_kind_classification_errorS_idx)
WHERE kind = 'CHECKER' AND countAsDecision = 1 AND rawError IS NOT NULL
  AND errorSeverity = ?
  AND JSON_UNQUOTE(JSON_EXTRACT(raw, '$.reviews[0].source_position.formatted_value')) = ?
```

Five predicates, four of them equality (`kind`, `countAsDecision`, `errorSeverity`, the JSON-extracted position), one `IS NOT NULL` range-ish (`rawError`). Once the column exists, the last predicate becomes a plain equality on an indexed column instead of an unindexed function result.

**`recompute-repeated-positions.ts`** (`lib/recompute-repeated-positions.ts:46-52`) — exact current query:

```sql
SELECT
  JSON_UNQUOTE(JSON_EXTRACT(raw, '$.reviews[0].source_position.formatted_value')) AS sourcePositionId,
  classification, errorSeverity, plyNumber
FROM Decision
WHERE kind = 'CHECKER' AND countAsDecision = 1 AND rawError IS NOT NULL
```

No filter on position or severity at all — it's a bulk, unaggregated read of ~510k rows, grouped client-side in JS afterward. The column helps this query only as a cheaper *projection* (plain column read vs. a `JSON_EXTRACT`/`JSON_UNQUOTE` function call per row); it does not change what the `WHERE` clause can use, since neither `sourcePositionId` nor `errorSeverity` is a filter predicate here.

**`extractDecisions`/`decisionFromRow`/`decisionFromRowForReplay`** — all three only ever *read* `sourcePositionId` off a row they've already fetched by `id`/`eventId` (board display). None of them filter or sort the database by it. The column change here is purely "stop parsing `raw` for a value ingest will now store directly" — no new index need, same category of win as Step 1's `notationPlayed`/`notationBest` fix.

### Selectivity evidence (real data, local dev DB)

| Measurement | Value |
|---|---|
| Total `Decision` rows | 1,257,534 |
| Distinct `sourcePositionId` values (all rows) | 609,305 |
| Rows matching `kind='CHECKER' AND countAsDecision=1 AND rawError IS NOT NULL` (the base filter in both queries above) | 510,307 |
| `RepeatedPosition` pairs (i.e. `(sourcePositionId, errorSeverity)` combos with count > 1 under that same base filter) | 4,784 |
| Average `occurrenceCount` among those pairs | 10.63 |
| Max `occurrenceCount` among those pairs (the single worst case) | 10,923 |

`EXPLAIN` on the *current* query (no `sourcePositionId` index exists yet, so this is the baseline being replaced):

```
-- unforced: optimizer picks (kind, classification) on kind alone
type: ref, key: Decision_kind_classification_idx, key_len: 1, rows: 494247, filtered: 12.5%

-- forced (today's production workaround): the composite mistake index
type: range, key: Decision_countAsDecision_rawError_kind_classification_errorS_idx, rows: 494247, filtered: 8.3%
```

Both plans scan on the order of ~494k rows and filter the `JSON_EXTRACT` equality out of that set afterward — there is currently no way to seek directly to a position, which is exactly the 11.4s-unforced/1.2s-forced gap already documented in the existing code comment.

Against that, `sourcePositionId` equality alone narrows ~1.26M rows down to an *average* of ~2 rows, and even the single worst-known `(sourcePositionId, errorSeverity)` pair narrows to 10,923 — two to three orders of magnitude smaller than the 494k the current plans scan, in every case including the worst one on record.

I attempted to get literal `EXPLAIN` output against a real index of this shape (built a scratch table from real extracted data, indexed identically to the proposal) rather than reasoning from cardinality alone, but the local dev DB's scoped `bg_db_rw` credential doesn't have `DROP`/`CREATE TABLE` privileges (confirmed directly — `DROP command denied to user 'bg_db_rw'`), consistent with this project's established credential-scoping (admin credentials are reserved for actual `migrate deploy`). I didn't escalate credentials for a throwaway scratch test on a report that isn't being implemented yet. The cardinality numbers above are real, measured against the real table, and are the same style of evidence the `plyNumber` index decision leaned on; I'd run a real `EXPLAIN` against the real new index as the first local verification step once Step 3 is actually implemented, before touching Oracle — same as every prior step in this plan.

### Proposed shape

```prisma
@@index([sourcePositionId, errorSeverity])
```

```sql
CREATE INDEX `Decision_sourcePositionId_errorSeverity_idx` ON `Decision`(`sourcePositionId`, `errorSeverity`);
```

Reasoning, mirroring the plyNumber index's narrow-vs-wide methodology:

- **Leads with `sourcePositionId`** because it's by far the most selective predicate in the query (609,305 distinct values; ~2 rows/value on average) — the same principle as leading the plyNumber index with `plyNumber` itself rather than `countAsDecision`.
- **`errorSeverity` second** — also an equality predicate, and it's the exact grouping granularity `recompute-repeated-positions.ts` already produces (`RepeatedPosition` is keyed by `(sourcePositionId, errorSeverity)`, not `sourcePositionId` alone). This mirrors `RepeatedPosition`'s own index column order exactly, which is deliberate: it's the same logical key.
- **`kind`, `countAsDecision`, `rawError IS NOT NULL` deliberately excluded from this index** — once `(sourcePositionId, errorSeverity)` narrows to a maximum-observed 10,923 rows (typically single digits), applying three cheap residual filters to that already-tiny set costs nothing. This is the same reasoning the plyNumber index decision used to exclude `kind`/`errorSeverity` from that index: a predicate that's cheap to apply after narrowing doesn't need to be baked into the index, and doing so would only cost write overhead for no read benefit here.
- **Not unique** — unlike `RepeatedPosition`'s unique index (one row per pair, by construction), many `Decision` rows legitimately share a `(sourcePositionId, errorSeverity)` pair — that's the literal definition of a repeated position.

## 3. Does this retire `FORCE INDEX` and the dropped-`GROUP BY` workaround?

**`findPositionOccurrences`'s `FORCE INDEX` hint: yes, fully retirable.** Once `(sourcePositionId, errorSeverity)` exists, it dominates every other candidate index by 2-3 orders of magnitude on the one predicate that matters most (the literal position), so the optimizer has no reason to reach for the composite mistake index at all — nothing to force. This also means the two-step "raw SQL for ids → `prisma.decision.findMany({ where: { id: { in: ... } } })`" dance can collapse into a single ordinary Prisma query:

```ts
prisma.decision.findMany({
  where: { kind: "CHECKER", countAsDecision: true, rawError: { not: null }, errorSeverity, sourcePositionId },
  select: DECISION_LIST_SELECT,
})
```

No raw SQL, no `FORCE INDEX`, no intermediate id list.

**`recompute-repeated-positions.ts`'s dropped-`GROUP BY` workaround: stays, for a different reason than before.** The new index doesn't change *why* a SQL-level `GROUP BY sourcePositionId, errorSeverity` would be slow here: this query's `WHERE` clause filters on `kind`/`countAsDecision`/`rawError`, none of which are a prefix of the new index, so MySQL can't use `(sourcePositionId, errorSeverity)` to both satisfy the `WHERE` and produce pre-grouped output — it would still need a temp table + filesort to group ~510k filtered rows by a key the index that served the `WHERE` clause doesn't share. The genuinely new benefit here is narrower than "index removes the need for this workaround": the column makes the *projection* of `sourcePositionId` cheap (a plain column read instead of a `JSON_EXTRACT`/`JSON_UNQUOTE` call per row, ~510k times), but the original 341s-vs-2s problem was the `GROUP BY`/temp-table mechanics, not the per-row extraction cost — so the unaggregated-SELECT-plus-in-JS-`Map` approach remains the right shape, and should stay exactly as-is, just reading a plain column instead of a JSON path.

## 4. Backfill script shape

Follows the established `backfill-ply-number.ts`/`backfill-played-at.ts` pattern exactly:

- Standalone script (`scripts/backfill-source-position-id.ts`), no live Galaxy calls — reads `raw` from already-ingested `Decision` rows only.
- `--dry-run` flag: computes and reports counts without writing.
- Extraction: `review.source_position?.formatted_value` from each row's own `raw` JSON — identical path to what `extractDecisions`/`decisionFromRow` already read at request time, so no new parsing logic needs to be invented, just lifted to a batch script.
- Idempotent: `WHERE sourcePositionId IS NULL` as the scope filter, so a partial/interrupted run can be safely re-run.
- Before/after counts: total rows, rows with `sourcePositionId` still null before, rows updated, rows with `sourcePositionId` still null after (expected: 0, given the confirmed 100% real-data coverage above).

**Expected scope**: all 1,257,534 `Decision` rows, not just the `countAsDecision`/`CHECKER` subset the two consuming queries filter on — `sourcePositionId` is read from every ingested row regardless of kind (confirmed: `reviews[0]` is present on 100% of rows, including CUBE/RESIGNATION kinds), and `decisionFromRow`/`decisionFromRowForReplay`/`extractDecisions` all read it unconditionally on every kind for display, not just CHECKER rows. Expected post-backfill null count: 0.

## Summary

| Question | Answer |
|---|---|
| Column type | `VARCHAR(191)` nullable, `COLLATE utf8mb4_bin` — same as `RepeatedPosition.sourcePositionId` except nullable (migration-sequencing, not a reliability gap; real coverage is 100%) |
| Index | `(sourcePositionId, errorSeverity)` — same column order as `RepeatedPosition`'s own index, chosen because `sourcePositionId` equality is ~2-3 orders of magnitude more selective than any other predicate in play (609,305 distinct values; worst-known pair 10,923 rows vs. today's ~494k-row scans) |
| `FORCE INDEX` hint | Fully retirable — the new index dominates, and the raw-SQL id-then-`findMany` dance can become one plain Prisma query |
| Dropped-`GROUP BY` workaround | **Stays** — the new index doesn't share a prefix with this query's `WHERE` clause, so SQL-level grouping would still need a temp table/filesort; the column only makes the per-row projection cheaper, not the grouping mechanics |
| Backfill script | `scripts/backfill-source-position-id.ts`, same `--dry-run`/raw-only/idempotent pattern as the two precedents; full 1,257,534-row scope (all kinds, not just CHECKER); expected 0 nulls remaining |

Nothing in this report has been implemented. Awaiting approval before writing the migration, updating `schema.prisma`, the two consuming call sites, or the backfill script.
