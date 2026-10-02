-- Decision.matchScoreBlack/matchScoreWhite/crawfordState were confirmed
-- write-only (never read anywhere) AND confirmed unreliable at this
-- per-decision granularity (a subset of events in a game report
-- metadata.scores as null while sibling events in the same game report the
-- real value) — see reports/2026-10-02-raw-field-reverification.md and the
-- Decision/Game model comments in prisma/schema.prisma. A plain DROP is
-- correct here (unlike the notationPlayed/notationBest rename in the
-- previous migration): these aren't being renamed, they're being replaced
-- by a differently-resolved value at a different granularity (one actor-
-- relative value per Game, not an unreliable value per Decision), backfilled
-- separately by scripts/backfill-game-score-crawford.ts.
ALTER TABLE `Decision` DROP COLUMN `crawfordState`,
    DROP COLUMN `matchScoreBlack`,
    DROP COLUMN `matchScoreWhite`;

-- AlterTable
ALTER TABLE `Game` ADD COLUMN `crawfordState` VARCHAR(191) NULL,
    ADD COLUMN `opponentScore` INTEGER NULL,
    ADD COLUMN `userScore` INTEGER NULL;
