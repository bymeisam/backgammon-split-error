// The signed-in user's effective role, from the two independent sources.
// Pure, so it's unit-tested (lib/appRole.test.ts); lib/app-auth.ts reads
// the inputs (AppUser.role from the DB, Clerk's privateMetadata.isOwner).
//
//   - OWNER needs both: DB role OWNER and the Clerk flag. Either alone is
//     not enough for owner access.
//   - DB OWNER without the Clerk flag falls back to MEMBER (still invited).
//   - DB MEMBER is MEMBER, whatever the Clerk flag says.
//   - Anything else (no AppUser row, DB NONE) is NONE: awaiting approval.
//     The Clerk flag on its own grants nothing.

export type AppRole = "OWNER" | "MEMBER" | "NONE";

export function resolveAppRole(dbRole: AppRole | null, clerkIsOwner: boolean): AppRole {
  if (dbRole === "OWNER") return clerkIsOwner ? "OWNER" : "MEMBER";
  if (dbRole === "MEMBER") return "MEMBER";
  return "NONE";
}

// Whether a role may see a member page or call a member API.
export function isMemberOrOwner(role: AppRole | null | undefined): boolean {
  return role === "OWNER" || role === "MEMBER";
}
