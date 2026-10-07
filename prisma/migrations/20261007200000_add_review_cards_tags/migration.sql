-- Spaced-repetition review (Phase B of reports/2026-10-07-review-feature-
-- plan.md): ReviewCard (one per Decision, its FSRS schedule), ReviewLog (one
-- row per answer), Tag and DecisionTag (free-form tags on decisions).
-- Generated with `prisma migrate diff --from-config-datasource --to-schema`
-- (the local DB users can't create migrate dev's shadow database), checked
-- by hand, and applied with `prisma migrate deploy`.
--
-- Four new, empty tables; nothing existing is altered, so no existing
-- collation pin (Match.sourceMatchId, PlayerIdentity.sourceUserId,
-- Decision.userId, Decision.sourcePositionId,
-- RepeatedPosition.sourcePositionId) is touched.
--
-- No COLLATE utf8mb4_bin anywhere in this migration, deliberately: no column
-- stores an externally-sourced string identifier (CLAUDE.md;
-- docs/field-mapping.md, "Collation for externally-sourced identifiers").
-- Keys are internal INTEGERs; ReviewLog.chosen is the app's own option key
-- (a move notation or a fixed cube key); Tag.name is user text, where the
-- table default utf8mb4_unicode_ci is wanted: its case-insensitive UNIQUE
-- makes "Prime" and "prime" one tag.
--
-- Foreign keys: RESTRICT (Prisma's default, as everywhere else in this
-- schema) from ReviewCard and DecisionTag to Decision, so a decision with a
-- card or tags can't be silently deleted. CASCADE from ReviewLog to
-- ReviewCard (deleting a card deletes its review history) and from
-- DecisionTag to Tag (deleting a tag removes it from every decision).

-- CreateTable
CREATE TABLE `ReviewCard` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `decisionId` INTEGER NOT NULL,
    `due` DATETIME(3) NOT NULL,
    `stability` DOUBLE NOT NULL,
    `difficulty` DOUBLE NOT NULL,
    `elapsedDays` INTEGER NOT NULL,
    `scheduledDays` INTEGER NOT NULL,
    `learningSteps` INTEGER NOT NULL,
    `reps` INTEGER NOT NULL,
    `lapses` INTEGER NOT NULL,
    `state` INTEGER NOT NULL,
    `lastReview` DATETIME(3) NULL,
    `suspended` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ReviewCard_decisionId_key`(`decisionId`),
    INDEX `ReviewCard_suspended_due_idx`(`suspended`, `due`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ReviewLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cardId` INTEGER NOT NULL,
    `rating` INTEGER NOT NULL,
    `correct` BOOLEAN NOT NULL,
    `chosen` VARCHAR(191) NOT NULL,
    `loss` DOUBLE NULL,
    `stateBefore` JSON NOT NULL,
    `reviewedAt` DATETIME(3) NOT NULL,
    `durationMs` INTEGER NULL,

    INDEX `ReviewLog_cardId_reviewedAt_idx`(`cardId`, `reviewedAt`),
    INDEX `ReviewLog_reviewedAt_idx`(`reviewedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Tag` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(64) NOT NULL,

    UNIQUE INDEX `Tag_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DecisionTag` (
    `decisionId` INTEGER NOT NULL,
    `tagId` INTEGER NOT NULL,

    INDEX `DecisionTag_tagId_idx`(`tagId`),
    PRIMARY KEY (`decisionId`, `tagId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ReviewCard` ADD CONSTRAINT `ReviewCard_decisionId_fkey` FOREIGN KEY (`decisionId`) REFERENCES `Decision`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReviewLog` ADD CONSTRAINT `ReviewLog_cardId_fkey` FOREIGN KEY (`cardId`) REFERENCES `ReviewCard`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DecisionTag` ADD CONSTRAINT `DecisionTag_decisionId_fkey` FOREIGN KEY (`decisionId`) REFERENCES `Decision`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DecisionTag` ADD CONSTRAINT `DecisionTag_tagId_fkey` FOREIGN KEY (`tagId`) REFERENCES `Tag`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

