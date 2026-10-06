-- DecisionNote: the user's own free-text note on one decision (1:1 with
-- Decision via the unique decisionId). Generated with
-- `prisma migrate diff --from-config-datasource --to-schema` (the local DB
-- users can't create migrate dev's shadow database) and applied with
-- `prisma migrate deploy`.
--
-- No COLLATE utf8mb4_bin anywhere in this table, deliberately: decisionId is
-- an internal INTEGER key and note is free user text, so no column stores an
-- externally-sourced string identifier (see docs/field-mapping.md's
-- "Collation for externally-sourced identifiers"). The table default
-- (utf8mb4_unicode_ci) is fine for user text.
--
-- The FK keeps Prisma's default ON DELETE RESTRICT, same as every other FK
-- in this schema: a Decision with a note can't be deleted without deleting
-- the note first (prisma/seed.ts does exactly that).

-- CreateTable
CREATE TABLE `DecisionNote` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `decisionId` INTEGER NOT NULL,
    `note` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `DecisionNote_decisionId_key`(`decisionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `DecisionNote` ADD CONSTRAINT `DecisionNote_decisionId_fkey` FOREIGN KEY (`decisionId`) REFERENCES `Decision`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
