-- Adds Decision.plyNumber (ordinal position among a game's own CHECKER
-- decisions, 1-4, null beyond) and the same column on RepeatedPosition as
-- an additional, independent grouping dimension alongside classification/
-- errorSeverity. Both are plain nullable ints — no collation concern here
-- (that rule only applies to externally-sourced STRING identifiers; see
-- docs/field-mapping.md's "Collation for externally-sourced identifiers"
-- and its new "Ply number" section for why this column doesn't need it).
-- Replaces the previous Galaxy-specific STARTING_POSITION_ID/position-ID
-- matching approach entirely (removed in this same change) — see
-- docs/field-mapping.md's "Ply number" section for the full reasoning.

-- DropIndex
DROP INDEX `RepeatedPosition_sourcePositionId_errorSeverity_key` ON `RepeatedPosition`;

-- AlterTable
ALTER TABLE `Decision` ADD COLUMN `plyNumber` INTEGER NULL;

-- AlterTable
ALTER TABLE `RepeatedPosition` ADD COLUMN `plyNumber` INTEGER NULL;

-- CreateIndex
CREATE INDEX `RepeatedPosition_plyNumber_idx` ON `RepeatedPosition`(`plyNumber`);

-- CreateIndex
CREATE UNIQUE INDEX `RepeatedPosition_sourcePositionId_errorSeverity_plyNumber_key` ON `RepeatedPosition`(`sourcePositionId`, `errorSeverity`, `plyNumber`);
