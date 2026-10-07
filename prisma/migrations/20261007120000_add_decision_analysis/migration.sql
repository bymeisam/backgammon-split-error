-- Decision.analysis: a source-neutral, versioned copy of a decision's engine
-- analysis (lib/analysis/types.ts), filled by a per-source translator at
-- ingest and by scripts/backfill-decision-analysis.ts for existing rows.
-- Generated with `prisma migrate diff --from-config-datasource --to-schema`
-- (the local DB users can't create migrate dev's shadow database) and
-- applied with `prisma migrate deploy`.
--
-- No COLLATE utf8mb4_bin, deliberately: the column is JSON, which has no
-- collation of its own (MySQL stores JSON in a binary format and compares
-- JSON strings by utf8mb4_bin anyway), and it doesn't store an
-- externally-sourced string identifier as a column value (see
-- docs/field-mapping.md's "Collation for externally-sourced identifiers").
--
-- Nullable with no default, so every existing row starts as NULL until the
-- backfill runs.

-- AlterTable
ALTER TABLE `Decision` ADD COLUMN `analysis` JSON NULL;
