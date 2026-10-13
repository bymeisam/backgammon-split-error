-- Forum write credential (bg_db_forum) for Oracle MySQL, database `backgammon`.
--
-- Used by prismaForum (lib/prisma.ts) through DATABASE_URL_FORUM, which is set
-- on Vercel so the live site can accept forum posts without the admin
-- credential (bg_db_rw / DATABASE_URL). Galaxy, sync, notes and review stay
-- off there. See docs/field-mapping.md § Credential scoping and docs/deploy.md.
--
-- RUN ONLY:
--   * after the forum migrations are deployed to Oracle (ForumMoveProposal,
--     from 20261013140000_forum_move_proposal, must exist, or its GRANT fails);
--   * with the owner's explicit approval, as the Oracle admin user.
--
-- Replace <PASSWORD> with a generated secret before running. Never commit the
-- real password.

CREATE USER `bg_db_forum`@`%` IDENTIFIED BY '<PASSWORD>';

-- Forum tables: posts, replies, attached positions and move proposals.
GRANT SELECT, INSERT, UPDATE, DELETE ON `backgammon`.`ForumPost` TO `bg_db_forum`@`%`;
GRANT SELECT, INSERT, UPDATE, DELETE ON `backgammon`.`ForumReply` TO `bg_db_forum`@`%`;
GRANT SELECT, INSERT, UPDATE, DELETE ON `backgammon`.`ForumPostPosition` TO `bg_db_forum`@`%`;
GRANT SELECT, INSERT, UPDATE, DELETE ON `backgammon`.`StudyPosition` TO `bg_db_forum`@`%`;
GRANT SELECT, INSERT, UPDATE, DELETE ON `backgammon`.`ForumMoveProposal` TO `bg_db_forum`@`%`;

-- Read-only lookups: foreign-key checks on the author (AppUser) and the source
-- decision a position is attached from (Decision).
GRANT SELECT ON `backgammon`.`AppUser` TO `bg_db_forum`@`%`;
GRANT SELECT ON `backgammon`.`Decision` TO `bg_db_forum`@`%`;
