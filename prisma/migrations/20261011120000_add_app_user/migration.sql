-- AppUser provisions Clerk identities locally without changing existing source/study tables.
-- `clerkUserId` is externally sourced; Prisma cannot express MySQL collation, so
-- this migration hand-pins it to binary/case-sensitive comparison.
CREATE TABLE `AppUser` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `clerkUserId` VARCHAR(191) NOT NULL COLLATE utf8mb4_bin,
    `displayName` VARCHAR(191) NOT NULL,
    `isOwner` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AppUser_clerkUserId_key`(`clerkUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
