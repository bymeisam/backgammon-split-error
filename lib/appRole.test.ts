import { describe, expect, it } from "vitest";
import { isMemberOrOwner, NEW_APP_USER_ROLE, resolveAppRole } from "./appRole";

describe("resolveAppRole", () => {
  it.each([
    ["OWNER", true, "OWNER"],
    ["OWNER", false, "MEMBER"],
    ["MEMBER", true, "MEMBER"],
    ["MEMBER", false, "MEMBER"],
    ["NONE", true, "NONE"],
    ["NONE", false, "NONE"],
    [null, true, "NONE"],
    [null, false, "NONE"],
  ] as const)("DB role %s with Clerk owner flag %s is %s", (dbRole, clerkIsOwner, expected) => {
    expect(resolveAppRole(dbRole, clerkIsOwner)).toBe(expected);
  });
});

describe("isMemberOrOwner", () => {
  it("is true for OWNER and MEMBER only", () => {
    expect(isMemberOrOwner("OWNER")).toBe(true);
    expect(isMemberOrOwner("MEMBER")).toBe(true);
    expect(isMemberOrOwner("NONE")).toBe(false);
    expect(isMemberOrOwner(null)).toBe(false);
    expect(isMemberOrOwner(undefined)).toBe(false);
  });
});

describe("NEW_APP_USER_ROLE", () => {
  it("is MEMBER: sign-up is invite-only, so a new row has member access and is never OWNER", () => {
    expect(NEW_APP_USER_ROLE).toBe("MEMBER");
    expect(isMemberOrOwner(resolveAppRole(NEW_APP_USER_ROLE, true))).toBe(true);
    expect(resolveAppRole(NEW_APP_USER_ROLE, true)).toBe("MEMBER");
  });
});
