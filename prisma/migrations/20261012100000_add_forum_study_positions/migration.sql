-- Forum-authored positions are application data. GNU identifiers are exact, case-sensitive encodings.
CREATE TABLE `StudyPosition` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `createdByAppUserId` INTEGER NOT NULL,
  `origin` ENUM('MANUAL', 'MATCH_DECISION') NOT NULL,
  `positionId` VARCHAR(191) COLLATE utf8mb4_bin NOT NULL,
  `gnuMatchId` VARCHAR(191) COLLATE utf8mb4_bin NOT NULL,
  `kind` ENUM('CHECKER', 'CUBE') NOT NULL,
  `sourceDecisionId` INTEGER NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `StudyPosition_sourceDecisionId_idx` (`sourceDecisionId`),
  INDEX `StudyPosition_positionId_idx` (`positionId`),
  INDEX `StudyPosition_createdByAppUserId_createdAt_idx` (`createdByAppUserId`, `createdAt`),
  CONSTRAINT `StudyPosition_createdByAppUserId_fkey` FOREIGN KEY (`createdByAppUserId`) REFERENCES `AppUser` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `StudyPosition_sourceDecisionId_fkey` FOREIGN KEY (`sourceDecisionId`) REFERENCES `Decision` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ForumPost` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `authorAppUserId` INTEGER NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `body` TEXT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `ForumPost_authorAppUserId_idx` (`authorAppUserId`),
  CONSTRAINT `ForumPost_authorAppUserId_fkey` FOREIGN KEY (`authorAppUserId`) REFERENCES `AppUser` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ForumPostPosition` (
  `postId` INTEGER NOT NULL,
  `studyPositionId` INTEGER NOT NULL,
  `displayOrder` INTEGER NOT NULL,
  PRIMARY KEY (`postId`, `studyPositionId`),
  INDEX `ForumPostPosition_studyPositionId_idx` (`studyPositionId`),
  CONSTRAINT `ForumPostPosition_postId_fkey` FOREIGN KEY (`postId`) REFERENCES `ForumPost` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `ForumPostPosition_studyPositionId_fkey` FOREIGN KEY (`studyPositionId`) REFERENCES `StudyPosition` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ForumReply` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `postId` INTEGER NOT NULL,
  `authorAppUserId` INTEGER NOT NULL,
  `body` TEXT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `ForumReply_postId_createdAt_idx` (`postId`, `createdAt`),
  INDEX `ForumReply_authorAppUserId_idx` (`authorAppUserId`),
  CONSTRAINT `ForumReply_postId_fkey` FOREIGN KEY (`postId`) REFERENCES `ForumPost` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `ForumReply_authorAppUserId_fkey` FOREIGN KEY (`authorAppUserId`) REFERENCES `AppUser` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
