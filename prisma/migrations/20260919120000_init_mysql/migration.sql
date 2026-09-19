-- CreateTable
CREATE TABLE `Match` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `source` VARCHAR(191) NOT NULL,
    -- Explicit binary collation: (source, sourceMatchId) uniqueness must be
    -- case-sensitive, not MySQL's default case-insensitive comparison.
    -- MANUAL EDIT: Prisma's schema DSL has no collation attribute for MySQL
    -- (@db.Collation exists only for SQL Server). This COLLATE clause was
    -- hand-added directly to the generated migration SQL. `prisma migrate dev`
    -- will NOT regenerate or preserve this on its own — if this column's
    -- definition changes in the future, the COLLATE clause must be manually
    -- re-added to the new migration, or this fix will silently revert to the
    -- database's default (case-insensitive) collation.
    `sourceMatchId` VARCHAR(191) NOT NULL COLLATE utf8mb4_bin,
    `matchLength` INTEGER NULL,
    `opponentName` VARCHAR(191) NOT NULL,
    `opponentCountry` VARCHAR(191) NOT NULL,
    `opponentRating` DOUBLE NOT NULL,
    `opponentError` DOUBLE NOT NULL,
    `opponentScore` INTEGER NOT NULL,
    `userError` DOUBLE NOT NULL,
    `userRating` DOUBLE NOT NULL,
    `userScore` INTEGER NOT NULL,
    `playedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Match_source_sourceMatchId_key`(`source`, `sourceMatchId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PlayerIdentity` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `source` VARCHAR(191) NOT NULL,
    -- Same reasoning as Match.sourceMatchId above.
    -- MANUAL EDIT: Prisma's schema DSL has no collation attribute for MySQL
    -- (@db.Collation exists only for SQL Server). This COLLATE clause was
    -- hand-added directly to the generated migration SQL. `prisma migrate dev`
    -- will NOT regenerate or preserve this on its own — if this column's
    -- definition changes in the future, the COLLATE clause must be manually
    -- re-added to the new migration, or this fix will silently revert to the
    -- database's default (case-insensitive) collation.
    `sourceUserId` VARCHAR(191) NOT NULL COLLATE utf8mb4_bin,
    `displayName` VARCHAR(191) NOT NULL,
    `isMe` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `PlayerIdentity_source_sourceUserId_key`(`source`, `sourceUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Game` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `matchId` INTEGER NOT NULL,
    `gameIndex` INTEGER NOT NULL,
    `playedAt` DATETIME(3) NULL,

    UNIQUE INDEX `Game_matchId_gameIndex_key`(`matchId`, `gameIndex`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Decision` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `gameId` INTEGER NOT NULL,
    `eventId` BIGINT NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `color` VARCHAR(191) NOT NULL,
    `kind` ENUM('CHECKER', 'CUBE') NOT NULL,
    `analysedEvent` VARCHAR(191) NOT NULL,
    `countAsDecision` BOOLEAN NOT NULL,
    `rawError` DOUBLE NOT NULL,
    `errorSeverity` ENUM('NONE', 'DOUBTFUL', 'ERROR', 'BLUNDER') NOT NULL,
    `isBlunder` BOOLEAN NOT NULL,
    `luck` DOUBLE NULL,
    `luckMwc` DOUBLE NULL,
    `equity` DOUBLE NULL,
    `mwc` DOUBLE NULL,
    `classification` VARCHAR(191) NOT NULL,
    `matchScoreBlack` INTEGER NOT NULL,
    `matchScoreWhite` INTEGER NOT NULL,
    `crawfordState` VARCHAR(191) NOT NULL,
    `cubeOwnerUserId` VARCHAR(191) NULL,
    `notationPlayed` VARCHAR(191) NULL,
    `notationBest` VARCHAR(191) NULL,
    `cubeDetail` VARCHAR(191) NULL,
    `timestamp` DATETIME(3) NOT NULL,
    `myTag` VARCHAR(191) NULL,
    `raw` JSON NOT NULL,

    INDEX `Decision_kind_classification_idx`(`kind`, `classification`),
    INDEX `Decision_userId_idx`(`userId`),
    UNIQUE INDEX `Decision_gameId_eventId_key`(`gameId`, `eventId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Game` ADD CONSTRAINT `Game_matchId_fkey` FOREIGN KEY (`matchId`) REFERENCES `Match`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Decision` ADD CONSTRAINT `Decision_gameId_fkey` FOREIGN KEY (`gameId`) REFERENCES `Game`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
