import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const LOCAL = "mysql://app:app@localhost:3306/app_dev";
const ORACLE = "mysql://bg_db_rw:pw@203.0.113.7:3306/backgammon?ssl=true";

// Fresh module per test so the warn-once flag starts clear.
async function load() {
  vi.resetModules();
  return import("./localAuthBypass");
}

describe("isLocalAuthBypass", () => {
  beforeEach(() => {
    vi.stubEnv("AUTH_BYPASS", undefined);
    vi.stubEnv("DATABASE_URL", LOCAL);
    vi.stubEnv("DATABASE_URL_READONLY", undefined);
    vi.stubEnv("DATABASE_URL_APP", undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("is off unless AUTH_BYPASS is exactly true, even under next dev", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const { isLocalAuthBypass } = await load();
    expect(isLocalAuthBypass()).toBe(false);
    vi.stubEnv("AUTH_BYPASS", "1");
    expect(isLocalAuthBypass()).toBe(false);
  });

  it("turns on with AUTH_BYPASS=true against a local database", async () => {
    vi.stubEnv("AUTH_BYPASS", "true");
    vi.stubEnv("DATABASE_URL_READONLY", "mysql://bg_db_ro:pw@127.0.0.1:3306/app_dev");
    const { isLocalAuthBypass } = await load();
    expect(isLocalAuthBypass()).toBe(true);
  });

  it("refuses when DATABASE_URL points at Oracle, warning once", async () => {
    vi.stubEnv("AUTH_BYPASS", "true");
    vi.stubEnv("DATABASE_URL", ORACLE);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { isLocalAuthBypass } = await load();
    expect(isLocalAuthBypass()).toBe(false);
    expect(isLocalAuthBypass()).toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("refuses when DATABASE_URL is missing", async () => {
    vi.stubEnv("AUTH_BYPASS", "true");
    vi.stubEnv("DATABASE_URL", undefined);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { isLocalAuthBypass } = await load();
    expect(isLocalAuthBypass()).toBe(false);
  });

  it("refuses when the read-only URL points at Oracle", async () => {
    vi.stubEnv("AUTH_BYPASS", "true");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubEnv("DATABASE_URL_READONLY", ORACLE);
    expect((await load()).isLocalAuthBypass()).toBe(false);
  });

  it("refuses when the app URL points at Oracle, and allows a local or empty one", async () => {
    vi.stubEnv("AUTH_BYPASS", "true");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubEnv("DATABASE_URL_APP", "mysql://bg_db_app:pw@203.0.113.7:3306/backgammon?ssl=true");
    expect((await load()).isLocalAuthBypass()).toBe(false);
    vi.stubEnv("DATABASE_URL_APP", LOCAL);
    expect((await load()).isLocalAuthBypass()).toBe(true);
    vi.stubEnv("DATABASE_URL_APP", "");
    expect((await load()).isLocalAuthBypass()).toBe(true);
  });
});

describe("localBypassIdentity", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is the owner by default", async () => {
    vi.stubEnv("AUTH_BYPASS_ROLE", undefined);
    const { localBypassIdentity, LOCAL_DEV_OWNER_CLERK_ID } = await load();
    expect(localBypassIdentity()).toMatchObject({ clerkUserId: LOCAL_DEV_OWNER_CLERK_ID, role: "OWNER" });
    vi.stubEnv("AUTH_BYPASS_ROLE", "owner");
    expect(localBypassIdentity().role).toBe("OWNER");
  });

  it("is a separate member user with AUTH_BYPASS_ROLE=member", async () => {
    vi.stubEnv("AUTH_BYPASS_ROLE", "member");
    const { localBypassIdentity, LOCAL_DEV_MEMBER_CLERK_ID, LOCAL_DEV_OWNER_CLERK_ID } = await load();
    const identity = localBypassIdentity();
    expect(identity).toMatchObject({ clerkUserId: LOCAL_DEV_MEMBER_CLERK_ID, role: "MEMBER" });
    expect(identity.clerkUserId).not.toBe(LOCAL_DEV_OWNER_CLERK_ID);
  });
});
