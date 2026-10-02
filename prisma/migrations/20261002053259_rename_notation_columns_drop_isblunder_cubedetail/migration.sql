-- Hand-edited: Prisma's default for a field rename (no @map) is a
-- DROP+ADD, which would silently lose every existing notationPlayed/
-- notationBest value (590,933 non-null rows at the time this migration was
-- written). Using CHANGE COLUMN (MySQL's rename-in-place syntax) instead so
-- real data survives the rename — see reports/2026-10-02-raw-field-
-- reverification.md and the Decision.movePlayed/moveBest schema comments.

-- RenameColumn (preserves data)
ALTER TABLE `Decision` CHANGE COLUMN `notationPlayed` `movePlayed` VARCHAR(191) NULL;
ALTER TABLE `Decision` CHANGE COLUMN `notationBest` `moveBest` VARCHAR(191) NULL;

-- AlterTable: drop confirmed-unused columns (isBlunder: redundant with
-- errorSeverity, 0 mismatches/371 real rows checked; cubeDetail: confirmed
-- never rendered anywhere), add the new CUBE-kind action-label pair
-- (replaces cubeDetail, backfilled separately by
-- scripts/backfill-cube-action-labels.ts).
ALTER TABLE `Decision` DROP COLUMN `cubeDetail`,
    DROP COLUMN `isBlunder`,
    ADD COLUMN `cubeActionBest` VARCHAR(191) NULL,
    ADD COLUMN `cubeActionPlayed` VARCHAR(191) NULL;
