-- AppUser.isOwner (boolean) becomes AppUser.role (OWNER | MEMBER | NONE), so
-- invited members can be told apart from users awaiting approval. Existing
-- owners keep owner access: role = OWNER wherever isOwner was true, before
-- isOwner is dropped. Everyone else starts NONE (awaiting approval).
-- clerkUserId is untouched, so its hand-added COLLATE utf8mb4_bin (see
-- 20261011120000_add_app_user) is preserved.
ALTER TABLE `AppUser` ADD COLUMN `role` ENUM('OWNER', 'MEMBER', 'NONE') NOT NULL DEFAULT 'NONE';

UPDATE `AppUser` SET `role` = 'OWNER' WHERE `isOwner` = true;

ALTER TABLE `AppUser` DROP COLUMN `isOwner`;
