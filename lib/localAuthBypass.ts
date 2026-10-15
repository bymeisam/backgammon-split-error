import { isLocalTarget } from "@/lib/databaseUrl";

export const LOCAL_DEV_OWNER_CLERK_ID = "local-dev-owner";
// A separate bypass user for AUTH_BYPASS_ROLE=member, so trying the member
// view never changes the local owner row.
export const LOCAL_DEV_MEMBER_CLERK_ID = "local-dev-member";

export type LocalBypassIdentity = {
  clerkUserId: string;
  displayName: string;
  // The role the bypass acts with, in memory (getAppAuthState and
  // forumIdentity return it without reading AppUser.role).
  role: "OWNER" | "MEMBER";
  // The role written to the AppUser row, only when the row is first created
  // (existing rows' roles are never updated). The owner row is stored as
  // NONE because the database allows a single OWNER row (the unique
  // AppUser.ownerSlot, migration 20261014100000_app_user_single_owner), and
  // that slot belongs to the real Clerk owner. NONE grants nothing if the row
  // were ever read through the normal Clerk path.
  storedRole: "NONE" | "MEMBER";
};

/**
 * Who the local bypass signs in as: the owner by default, or a member with
 * AUTH_BYPASS_ROLE=member (anything else means owner). Only meaningful while
 * isLocalAuthBypass() is true.
 */
export function localBypassIdentity(): LocalBypassIdentity {
  if (process.env.AUTH_BYPASS_ROLE === "member") {
    return {
      clerkUserId: LOCAL_DEV_MEMBER_CLERK_ID,
      displayName: "Local development member",
      role: "MEMBER",
      storedRole: "MEMBER",
    };
  }
  return {
    clerkUserId: LOCAL_DEV_OWNER_CLERK_ID,
    displayName: "Local development owner",
    role: "OWNER",
    storedRole: "NONE",
  };
}

let warnedOracle = false;

/**
 * Temporary local-only bypass for exercising authenticated flows before Clerk
 * is configured in the development browser. Explicit opt-in: AUTH_BYPASS=true.
 *
 * It refuses to turn on unless lib/databaseUrl.ts's isLocalTarget() is true
 * (DB_TARGET is local and the read-write URL, plus the read-only and app URLs
 * when set, are all localhost; a missing or unparseable read-write URL is not
 * local), because the bypass upserts a local-dev-owner (or local-dev-member)
 * AppUser and posts as it. The owner role is held in memory only; the
 * local-dev-owner row itself is stored as NONE.
 */
export function isLocalAuthBypass(): boolean {
  if (process.env.AUTH_BYPASS !== "true") return false;

  if (isLocalTarget()) return true;

  if (!warnedOracle) {
    warnedOracle = true;
    console.warn(
      "AUTH_BYPASS=true ignored: DB_TARGET is not local, or a database URL is not localhost. The auth bypass only runs against a local database."
    );
  }
  return false;
}
