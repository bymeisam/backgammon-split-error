-- "resignation" events (event_type: "resigned") are a fourth, structurally
-- distinct decision shape — no cube_analysis, no moves, just resign_error/
-- should_resign/resignation_type/equity_before/equity_after (see
-- docs/field-mapping.md). All five new columns are nullable, populated only
-- for RESIGNATION-kind rows, same convention as notationPlayed/notationBest/
-- cubeDetail being null outside their own kind.
ALTER TABLE `Decision` ADD COLUMN `equityAfter` DOUBLE NULL,
    ADD COLUMN `equityBefore` DOUBLE NULL,
    ADD COLUMN `resignError` DOUBLE NULL,
    ADD COLUMN `resignationType` VARCHAR(191) NULL,
    ADD COLUMN `shouldResign` BOOLEAN NULL,
    MODIFY `kind` ENUM('CHECKER', 'CUBE', 'RESIGNATION') NOT NULL;
