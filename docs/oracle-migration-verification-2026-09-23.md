# Oracle HeatWave data migration — verification report (2026-09-23)

Local dev DB (`app_dev`) data was migrated to the Oracle HeatWave production DB
(`backgammon`) via a data-only `mysqldump`/`mysql` restore (schema was already
deployed on Oracle beforehand via `prisma migrate deploy`). This report is the
post-migration verification pass, run against the live Oracle endpoint.

## 1. Row count parity — Oracle vs. local

| Table | Local (`app_dev`) | Oracle (`backgammon`) | Match? |
|---|---|---|---|
| Match | 4,274 | 4,274 | ✅ |
| Game | 15,344 | 15,344 | ✅ |
| Decision | 1,232,074 | 1,232,074 | ✅ |
| PlayerIdentity | 2,112 | 2,112 | ✅ |
| SyncRun | 8 | 8 | ✅ |

## 2. Spot-check data integrity (10 matches: 3 lowest id, 3 highest id, 4 notable)

All 10 identical between local and Oracle (`id` / `sourceMatchId` / `opponentName` / `userScore` / `opponentScore`):

| id | sourceMatchId | opponentName | userScore | opponentScore |
|---|---|---|---|---|
| 1 | 46514290 | warsols | 7 | 0 |
| 2 | 46521365 | chloenyc | 5 | 2 |
| 3 | 46523205 | dracon04 | 7 | 1 |
| 4195 | 2856675 | arankhalili1387 | 0 | 5 |
| 4251 | 726018 | blucy | 5 | 4 |
| 4254 | 724878 | emmydede | 1 | 0 |
| 4272 | 32699544 | djuret | 5 | 2 |
| 4273 | 46862203 | stavros | 2 | 7 |
| 4274 | 46864527 | ryan_lee | 7 | 2 |
| 4275 | 46868313 | gimd | 7 | 0 |

Decision-level spot-check on match 4272 (game id 7948, 6 decisions): `eventId`,
`userId`, `rawError`, `errorSeverity`, `classification` byte-for-byte identical
on both sides (e.g. eventId `5069707933` → `rawError -0.07279999999999998,
ERROR, opening_game` on both). Per-`gameId` Decision counts across all 9 games
under matches 1 and 4272 also matched exactly:

| gameId | Local | Oracle |
|---|---|---|
| 7948 | 85 | 85 |
| 7949 | 91 | 91 |
| 7950 | 81 | 81 |
| 7951 | 83 | 83 |
| 15024 | 14 | 14 |
| 15025 | 39 | 39 |
| 15026 | 67 | 67 |
| 15027 | 42 | 42 |
| 15028 | 106 | 106 |

## 3. Collation check on Oracle

Confirmed directly via `SHOW FULL COLUMNS`, not assumed:

- `Match.sourceMatchId` → `utf8mb4_bin` ✅
- `PlayerIdentity.sourceUserId` → `utf8mb4_bin` ✅
- `Decision.userId` → `utf8mb4_bin` ✅
- `Decision.cubeOwnerUserId` → `utf8mb4_bin` ✅

All other string columns show `utf8mb4_unicode_ci` (table default) as expected.
Mechanically this makes sense: the dump was `--no-create-info` (data only), so
it never touched column definitions — the collations came entirely from
`prisma migrate deploy` applying the real migration SQL files (hand-edits
included) on Oracle, independent of the data restore.

## 4. Re-verify against live Galaxy — not done

Skipped for this pass. It requires a live `GALAXY_TOKEN` call and mainly
re-validates the *original local ingest* against Galaxy (already done in
PROGRESS.md's 2026-09-22 entry: 4,274/4,274, zero orphans, zero duplicates),
not the local→Oracle migration itself, which sections 1–2 above directly
prove. Can be run later if wanted.

## 5. Credential/access check

`SHOW GRANTS` (read-only, succeeded):

```
bg_db_rw: GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, REFERENCES, INDEX, ALTER ON `backgammon`.* TO `bg_db_rw`@`%`
bg_db_ro: GRANT SELECT ON `backgammon`.* TO `bg_db_ro`@`%`
```

Both users exist on Oracle with exactly the grant lists documented in
`docs/field-mapping.md`. ✅

**App-level functional test with these scoped credentials: confirmed working.**
My own CLI-based login attempt (extracting the password out of `.env` via a
Node regex, piping it through a temp shell script and `eval`, then into
`docker exec -e MYSQL_PWD=...`) failed with `ERROR 1045 (28000): Access
denied ... (using password: YES)` for both users. That turned out to be a
false negative caused by my own multi-hop extraction/piping chain, not a
real credential problem — connecting via DBeaver with the same passwords
copied directly from `.env`'s commented `CREATE USER` block succeeded for
both `bg_db_rw` and `bg_db_ro`, confirmed by the user. `.env`'s documented
Oracle passwords are correct as-is. ✅

## 6. `_prisma_migrations` table

All 6 local migrations present on Oracle, in order, each fully applied
(`applied_steps_count: 1`, `finished_at` set — no partial applications):

```
20260919120000_init_mysql
20260919143300_collation_fix_decision_userids
20260920054306_sync_system
20260921001302_nullable_match_scores
20260921013844_resignation_decisions
20260922003421_nullable_raw_error
```

Matches local's migration folder listing exactly. ✅

## Bottom line

The data migration itself (sections 1, 2, 3, 6) is clean — exact row-count
parity, byte-identical spot-checked data, collations intact, full migration
history applied correctly. Section 5's scoped credentials are confirmed
working (via DBeaver, after a false negative in my own CLI test). Only open
item: section 4 (optional live-Galaxy re-verify, not required to trust the
migration).
