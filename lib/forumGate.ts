import { isGalaxyEnabled } from "@/lib/galaxyGate";

// Whether forum writes (posts, replies, edits, deletes, attached positions and
// move proposals) are allowed. Separate from isGalaxyEnabled() on purpose:
// the live site (Vercel) deliberately has no DATABASE_URL and no
// ENABLE_WRITE_MODE, so Galaxy, sync, notes and review stay off there, but it
// does have DATABASE_URL_FORUM (the narrow bg_db_forum credential), which is
// all prismaForum needs.
//
// Locally there's usually no DATABASE_URL_FORUM: prismaForum falls back to
// DATABASE_URL outside production (lib/prisma.ts forumDatabaseUrl), so the
// usual write mode (isGalaxyEnabled) turns forum writes on too. Production
// never takes that fallback, so it needs DATABASE_URL_FORUM itself.
//
// Fails closed: with no env vars set this is false.
export function isForumWriteEnabled(): boolean {
  return (
    Boolean(process.env.DATABASE_URL_FORUM) ||
    (process.env.NODE_ENV !== "production" && isGalaxyEnabled())
  );
}
