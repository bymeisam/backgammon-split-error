-- Hand-added COLLATE utf8mb4_bin below: Prisma's schema DSL has no MySQL
-- collation attribute, so this won't survive a future `prisma migrate dev`
-- regeneration unless manually re-added. Externally-sourced identifier
-- (GNU Position ID) — pinned to a case-sensitive/binary collation rather
-- than the database default, same reasoning and exact collation as
-- RepeatedPosition.sourcePositionId (see
-- prisma/migrations/20260926153758_add_repeated_position and
-- docs/field-mapping.md's "Collation for externally-sourced identifiers").

-- AlterTable
ALTER TABLE `Decision` ADD COLUMN `sourcePositionId` VARCHAR(191) NULL COLLATE utf8mb4_bin;

-- CreateIndex
CREATE INDEX `Decision_sourcePositionId_errorSeverity_idx` ON `Decision`(`sourcePositionId`, `errorSeverity`);
