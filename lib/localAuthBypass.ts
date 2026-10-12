export const LOCAL_DEV_OWNER_CLERK_ID = "local-dev-owner";

/**
 * Temporary local-only bypass for exercising authenticated flows before Clerk
 * is configured in the development browser. Never enabled by production builds.
 */
export function isLocalAuthBypass(): boolean {
  return process.env.NODE_ENV === "development";
}
