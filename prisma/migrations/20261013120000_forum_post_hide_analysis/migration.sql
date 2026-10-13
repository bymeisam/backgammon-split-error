-- ForumPost.hideAnalysis: the author's choice to never show the engine
-- analysis of the post's game-sourced positions (Phase 2b). A boolean, so no
-- COLLATE is needed. Existing posts default to false (analysis available).
-- Hand-written from `prisma migrate diff`: the diff also proposed re-creating
-- StudyPosition_sourceDecisionId_fkey as ON DELETE SET NULL (Prisma's default
-- for an optional relation); that is pre-existing schema/migration drift and
-- is deliberately left out, so the FK stays ON DELETE RESTRICT.
ALTER TABLE `ForumPost` ADD COLUMN `hideAnalysis` BOOLEAN NOT NULL DEFAULT false;
