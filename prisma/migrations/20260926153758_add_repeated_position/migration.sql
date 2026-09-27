-- MANUAL EDIT: Prisma's schema DSL has no collation attribute for MySQL
-- (@db.Collation exists only for SQL Server). The COLLATE clause on
-- sourcePositionId below was hand-added directly to this generated
-- migration SQL — it's an externally-sourced string identifier (Galaxy's
-- GNU Position ID), and MySQL's default collation is case-insensitive,
-- which could silently merge two distinct positions differing only in
-- case (base64 is case-sensitive). `prisma migrate dev` will NOT
-- regenerate or preserve this on its own — if this column's definition
-- changes in the future, the COLLATE clause must be manually re-added, or
-- this fix will silently revert to the database's default collation. See
-- docs/field-mapping.md's "Collation for externally-sourced identifiers".
-- CreateTable
CREATE TABLE `RepeatedPosition` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sourcePositionId` VARCHAR(191) NOT NULL COLLATE utf8mb4_bin,
    `classification` VARCHAR(191) NOT NULL,
    `errorSeverity` ENUM('NONE', 'DOUBTFUL', 'ERROR', 'BLUNDER') NOT NULL,
    `occurrenceCount` INTEGER NOT NULL,
    `computedAt` DATETIME(3) NOT NULL,

    INDEX `RepeatedPosition_classification_errorSeverity_idx`(`classification`, `errorSeverity`),
    UNIQUE INDEX `RepeatedPosition_sourcePositionId_errorSeverity_key`(`sourcePositionId`, `errorSeverity`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
