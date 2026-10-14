-- At most one AppUser row may have role = 'OWNER' (there is one owner; a
-- second OWNER row must fail loudly rather than quietly share owner access).
--
-- ownerSlot is a generated column: 1 for the OWNER row, NULL for every other
-- row. MySQL unique indexes allow any number of NULLs, so the unique index
-- below constrains only OWNER rows (MEMBER and NONE rows are unaffected).
-- STORED rather than VIRTUAL: the table is tiny, so the one-off rebuild costs
-- nothing, and the indexed value is plainly materialized in the row.
--
-- Prisma's schema DSL can't express generated columns, so this is hand-written.
-- schema.prisma declares ownerSlot as a plain optional TinyInt with @unique so
-- that `prisma migrate diff` sees no drift (and proposes no DROP); Prisma
-- Client never writes it (MySQL rejects writes to a generated column).
-- No collation: numeric column.
ALTER TABLE `AppUser`
  ADD COLUMN `ownerSlot` TINYINT GENERATED ALWAYS AS (IF(`role` = 'OWNER', 1, NULL)) STORED;

CREATE UNIQUE INDEX `AppUser_ownerSlot_key` ON `AppUser`(`ownerSlot`);
