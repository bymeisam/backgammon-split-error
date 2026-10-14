// The signed-in user's effective role, from the two independent sources.
// Pure, so it's unit-tested (lib/appRole.test.ts); lib/app-auth.ts reads
// the inputs (AppUser.role from the DB, Clerk's privateMetadata.isOwner).
//
//   - OWNER needs both: DB role OWNER and the Clerk flag. Either alone is
//     not enough for owner access.
//   - DB OWNER without the Clerk flag falls back to MEMBER (still invited).
//   - DB MEMBER is MEMBER, whatever the Clerk flag says.
//   - Anything else (no AppUser row, DB NONE) is NONE: no access. New rows
//     start as MEMBER (NEW_APP_USER_ROLE: sign-up is invite-only in Clerk,
//     so the invitation is the approval); NONE is set by hand to cut
//     someone off. The Clerk flag on its own grants nothing.

export type AppRole = "OWNER" | "MEMBER" | "NONE";

// The role a newly provisioned AppUser row is created with. Never OWNER:
// the owner is set by hand (DB OWNER plus Clerk privateMetadata.isOwner).
export const NEW_APP_USER_ROLE = "MEMBER" satisfies AppRole;

export function resolveAppRole(dbRole: AppRole | null, clerkIsOwner: boolean): AppRole {
  if (dbRole === "OWNER") return clerkIsOwner ? "OWNER" : "MEMBER";
  if (dbRole === "MEMBER") return "MEMBER";
  return "NONE";
}

// Whether a role may see a member page or call a member API.
export function isMemberOrOwner(role: AppRole | null | undefined): boolean {
  return role === "OWNER" || role === "MEMBER";
}
