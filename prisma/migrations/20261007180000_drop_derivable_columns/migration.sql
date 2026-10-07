-- Drops the columns that only duplicated values already in Decision.raw (or
-- in each decision's own GNU Match ID inside it), or that nothing read. The
-- app derives them on demand from raw instead (lib/analysis/index.ts) — see
-- reports/2026-10-07-column-audit.md and docs/field-mapping.md, "Derived
-- from raw". raw itself is untouched.
--
-- Generated with `prisma migrate diff --from-config-datasource --to-schema`
-- (the local DB users can't create migrate dev's shadow database), checked by
-- hand, applied with `prisma migrate deploy`.
--
-- Hand-check:
--   * Only DROP COLUMN statements; no index is added, dropped or changed (no
--     dropped column is in any index).
--   * No kept column is altered, so the hand-added COLLATE utf8mb4_bin pins
--     on Decision.userId, Decision.sourcePositionId, Match.sourceMatchId,
--     PlayerIdentity.sourceUserId and RepeatedPosition.sourcePositionId are
--     untouched. Decision.cubeOwnerUserId was also pinned; it's dropped here,
--     so its pin goes with it.
--
-- Deploy order (Oracle): the previously deployed code selects these columns
-- (Prisma selects every model column on a plain findUnique/findMany), so it
-- breaks once they're gone, while the new code never reads them. Deploy the
-- new code first, then run this migration, with no ingest/sync in between:
-- the new code's Decision inserts omit color/analysedEvent/timestamp, which
-- are NOT NULL without a default until this migration drops them.

-- AlterTable
ALTER TABLE `Decision` DROP COLUMN `analysedEvent`,
    DROP COLUMN `color`,
    DROP COLUMN `cubeActionBest`,
    DROP COLUMN `cubeActionPlayed`,
    DROP COLUMN `cubeConfident`,
    DROP COLUMN `cubeOwnerUserId`,
    DROP COLUMN `cubeValue`,
    DROP COLUMN `equity`,
    DROP COLUMN `equityAfter`,
    DROP COLUMN `equityBefore`,
    DROP COLUMN `luck`,
    DROP COLUMN `luckMwc`,
    DROP COLUMN `moveBest`,
    DROP COLUMN `movePlayed`,
    DROP COLUMN `mwc`,
    DROP COLUMN `myTag`,
    DROP COLUMN `resignError`,
    DROP COLUMN `resignationType`,
    DROP COLUMN `roll`,
    DROP COLUMN `shouldResign`,
    DROP COLUMN `timestamp`;

-- AlterTable
ALTER TABLE `Game` DROP COLUMN `crawfordState`,
    DROP COLUMN `opponentScore`,
    DROP COLUMN `playedAt`,
    DROP COLUMN `userScore`;

-- AlterTable
ALTER TABLE `Match` DROP COLUMN `matchLength`;

