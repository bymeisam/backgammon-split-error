-- Forum move proposals: a reply's proposed checker play or cube action for one
-- of the post's study positions. Purely additive (new table, enum column,
-- indexes and FKs only). The known StudyPosition.sourceDecisionId FK onDelete
-- drift that `prisma migrate diff` also reports is deliberately NOT included.

-- CreateTable
CREATE TABLE `ForumMoveProposal` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `replyId` INTEGER NOT NULL,
    `studyPositionId` INTEGER NOT NULL,
    -- GNU Position ID after the proposed play. GNU identifiers are exact,
    -- case-sensitive encodings, so the column is pinned to binary collation
    -- (Prisma's schema DSL cannot express MySQL collations; see
    -- docs/field-mapping.md).
    `resultPositionId` VARCHAR(191) COLLATE utf8mb4_bin NULL,
    `notation` VARCHAR(64) NULL,
    `cubeAction` ENUM('NO_DOUBLE', 'DOUBLE_TAKE', 'DOUBLE_PASS', 'TOO_GOOD', 'TAKE', 'PASS') NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ForumMoveProposal_studyPositionId_resultPositionId_idx`(`studyPositionId`, `resultPositionId`),
    UNIQUE INDEX `ForumMoveProposal_replyId_studyPositionId_key`(`replyId`, `studyPositionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ForumMoveProposal` ADD CONSTRAINT `ForumMoveProposal_replyId_fkey` FOREIGN KEY (`replyId`) REFERENCES `ForumReply`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ForumMoveProposal` ADD CONSTRAINT `ForumMoveProposal_studyPositionId_fkey` FOREIGN KEY (`studyPositionId`) REFERENCES `StudyPosition`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
