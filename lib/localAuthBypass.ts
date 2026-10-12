import { isLocalDatabaseUrl } from "@/lib/runtimeMode";

export const LOCAL_DEV_OWNER_CLERK_ID = "local-dev-owner";

let warnedOracle = false;

/**
 * Temporary local-only bypass for exercising authenticated flows before Clerk
 * is configured in the development browser. Explicit opt-in: AUTH_BYPASS=true.
 *
 * It refuses to turn on when any database URL points at Oracle (by
 * lib/runtimeMode.ts's rule: anything but localhost, including a missing or
 * unparseable DATABASE_URL), because the bypass upserts a local-dev-owner
 * AppUser and posts as it. DATABASE_URL_AUTH and DATABASE_URL_READONLY are
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
