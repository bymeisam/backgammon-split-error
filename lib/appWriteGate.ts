import { isGalaxyEnabled } from "@/lib/galaxyGate";

// Whether in-app writes are allowed: the forum (posts, replies, edits, deletes,
// attached positions and move proposals) and the owner's study data (decision
// notes, tags, review cards and logs). Every one of those routes goes through
// prismaApp and checks this. AppUser provisioning also uses prismaApp but does
// not check this gate, so sign-in works wherever the client has a URL.
//
// Separate from isGalaxyEnabled() on purpose: that gate is for Galaxy and sync
// only. The live site (Vercel) deliberately has no DATABASE_URL and no
// ENABLE_WRITE_MODE, so Galaxy and sync stay off there, but it does have
// DATABASE_URL_APP (the narrow bg_db_app credential), which is all prismaApp
// needs.
//
// Locally there's usually no DATABASE_URL_APP: prismaApp falls back to
// DATABASE_URL outside production (lib/prisma.ts appDatabaseUrl), so the usual
// local write mode (isGalaxyEnabled) turns app writes on too. Production never
// takes that fallback, so it needs DATABASE_URL_APP itself.
//
// Fails closed: with no env vars set this is false.
export function isAppWriteEnabled(): boolean {
  return (
    Boolean(process.env.DATABASE_URL_APP) ||
    (process.env.NODE_ENV !== "production" && isGalaxyEnabled())
  );
}
