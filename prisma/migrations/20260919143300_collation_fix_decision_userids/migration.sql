-- Extends the case-sensitive/binary collation already applied to
-- Match.sourceMatchId and PlayerIdentity.sourceUserId to the two remaining
-- externally-sourced string identifier columns on Decision. Same reasoning:
-- MySQL's default collation is case-insensitive, which could silently merge
-- two distinct external user IDs that differ only in case — including in a
-- plain WHERE userId = ... lookup, not just unique constraints.
-- MANUAL EDIT: Prisma's schema DSL has no collation attribute for MySQL
-- (@db.Collation exists only for SQL Server). This COLLATE clause was
-- hand-added directly to the generated migration SQL. `prisma migrate dev`
-- will NOT regenerate or preserve this on its own — if this column's
-- definition changes in the future, the COLLATE clause must be manually
-- re-added to the new migration, or this fix will silently revert to the
-- database's default (case-insensitive) collation.
ALTER TABLE `Decision` MODIFY `userId` VARCHAR(191) NOT NULL COLLATE utf8mb4_bin;

-- MANUAL EDIT: Prisma's schema DSL has no collation attribute for MySQL
-- (@db.Collation exists only for SQL Server). This COLLATE clause was
-- hand-added directly to the generated migration SQL. `prisma migrate dev`
-- will NOT regenerate or preserve this on its own — if this column's
-- definition changes in the future, the COLLATE clause must be manually
-- re-added to the new migration, or this fix will silently revert to the
-- database's default (case-insensitive) collation.
ALTER TABLE `Decision` MODIFY `cubeOwnerUserId` VARCHAR(191) NULL COLLATE utf8mb4_bin;
