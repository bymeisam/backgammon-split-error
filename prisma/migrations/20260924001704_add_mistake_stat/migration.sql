-- CreateTable
CREATE TABLE `MistakeStat` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `classification` VARCHAR(191) NOT NULL,
    `category` ENUM('CHECKER', 'CUBE', 'RESIGNATION') NOT NULL,
    `errorSeverity` ENUM('NONE', 'DOUBTFUL', 'ERROR', 'BLUNDER') NOT NULL,
    `decisionCount` INTEGER NOT NULL,
    `sumAbsRawError` DOUBLE NOT NULL,
    `computedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `MistakeStat_classification_category_errorSeverity_key`(`classification`, `category`, `errorSeverity`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
