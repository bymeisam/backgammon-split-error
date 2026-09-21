-- Money-game-type matches don't populate metadata.scores at all (confirmed
-- against real data — see docs/field-mapping.md), so matchScoreBlack/White
-- must be nullable rather than assuming every decision has a running match
-- score.
ALTER TABLE `Decision` MODIFY `matchScoreBlack` INTEGER NULL,
    MODIFY `matchScoreWhite` INTEGER NULL;
