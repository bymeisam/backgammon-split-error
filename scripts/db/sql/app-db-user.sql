-- App write credential (bg_db_app) for Oracle MySQL, database `backgammon`.
--
-- Used by prismaApp (lib/prisma.ts) through the app URL (lib/databaseUrl.ts), set on
-- Vercel so the live site can do every in-app write without the admin
-- credential (bg_db_rw / the read-write URL): the forum, decision notes, tags,
-- review cards and logs, and AppUser provisioning. Galaxy and sync stay local
-- only. See docs/field-mapping.md § Credential scoping and docs/deploy.md.
--
-- No writes on Match, Game or Decision, and no DDL, on purpose: those belong
-- to sync and migrations, which run locally on bg_db_rw.
--
-- RUN ONLY:
--   * after the forum migrations are deployed to Oracle (ForumMoveProposal,
--     from 20261013140000_forum_move_proposal, must exist, or its GRANT fails);
--   * with the owner's explicit approval, as the HeatWave admin user.
--
-- Replace <PASSWORD> with a generated secret before running. Never commit the
-- real password.

CREATE USER `bg_db_app`@`%` IDENTIFIED BY '<PASSWORD>';

-- Reads: the study routes read Decision, Game, Match, etc. through joins.
GRANT SELECT ON `backgammon`.* TO `bg_db_app`@`%`;

-- Forum: posts, replies, attached positions and move proposals.
GRANT INSERT, UPDATE, DELETE ON `backgammon`.`ForumPost` TO `bg_db_app`@`%`;
GRANT INSERT, UPDATE, DELETE ON `backgammon`.`ForumReply` TO `bg_db_app`@`%`;
GRANT INSERT, UPDATE, DELETE ON `backgammon`.`ForumPostPosition` TO `bg_db_app`@`%`;
GRANT INSERT, UPDATE, DELETE ON `backgammon`.`StudyPosition` TO `bg_db_app`@`%`;
GRANT INSERT, UPDATE, DELETE ON `backgammon`.`ForumMoveProposal` TO `bg_db_app`@`%`;

-- Owner study: decision notes, tags, review cards and logs.
GRANT INSERT, UPDATE, DELETE ON `backgammon`.`DecisionNote` TO `bg_db_app`@`%`;
GRANT INSERT, UPDATE, DELETE ON `backgammon`.`Tag` TO `bg_db_app`@`%`;
GRANT INSERT, UPDATE, DELETE ON `backgammon`.`DecisionTag` TO `bg_db_app`@`%`;
GRANT INSERT, UPDATE, DELETE ON `backgammon`.`ReviewCard` TO `bg_db_app`@`%`;
GRANT INSERT, UPDATE, DELETE ON `backgammon`.`ReviewLog` TO `bg_db_app`@`%`;

-- Sign-in provisioning: creates and updates the signed-in user's AppUser row.
GRANT INSERT, UPDATE ON `backgammon`.`AppUser` TO `bg_db_app`@`%`;
