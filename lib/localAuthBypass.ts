import { isLocalDatabaseUrl } from "@/lib/runtimeMode";

export const LOCAL_DEV_OWNER_CLERK_ID = "local-dev-owner";
// A separate bypass user for AUTH_BYPASS_ROLE=member, so trying the member
// view never changes the local owner row.
export const LOCAL_DEV_MEMBER_CLERK_ID = "local-dev-member";

export type LocalBypassIdentity = {
  clerkUserId: string;
  displayName: string;
  role: "OWNER" | "MEMBER";
};

/**
 * Who the local bypass signs in as: the owner by default, or a member with
 * AUTH_BYPASS_ROLE=member (anything else means owner). Only meaningful while
 * isLocalAuthBypass() is true.
 */
export function localBypassIdentity(): LocalBypassIdentity {
  if (process.env.AUTH_BYPASS_ROLE === "member") {
    return { clerkUserId: LOCAL_DEV_MEMBER_CLERK_ID, displayName: "Local development member", role: "MEMBER" };
  }
  return { clerkUserId: LOCAL_DEV_OWNER_CLERK_ID, displayName: "Local development owner", role: "OWNER" };
}

let warnedOracle = false;

/**
 * Temporary local-only bypass for exercising authenticated flows before Clerk
 * is configured in the development browser. Explicit opt-in: AUTH_BYPASS=true.
 *
 * It refuses to turn on when any database URL points at Oracle (by
 * lib/runtimeMode.ts's rule: anything but localhost, including a missing or
 * unparseable DATABASE_URL), because the bypass upserts a local-dev-owner
 * (or local-dev-member) AppUser and posts as it. DATABASE_URL_AUTH and DATABASE_URL_READONLY are
 * checked too when set.
 */
export function isLocalAuthBypass(): boolean {
  if (process.env.AUTH_BYPASS !== "true") return false;

  const urls = [
    process.env.DATABASE_URL,
    ...[process.env.DATABASE_URL_AUTH, process.env.DATABASE_URL_READONLY].filter(
      (url): url is string => url !== undefined && url !== ""
    ),
  ];
  if (urls.every((url) => isLocalDatabaseUrl(url))) return true;

  if (!warnedOracle) {
    warnedOracle = true;
    console.warn(
      "AUTH_BYPASS=true ignored: a database URL points at Oracle (not localhost). The auth bypass only runs against a local database."
    );
  }
  return false;
}
