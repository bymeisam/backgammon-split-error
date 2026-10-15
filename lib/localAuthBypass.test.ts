import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DB_URL_VARS } from "./databaseUrl";

// The LOCAL_* names (DB_TARGET is stubbed to local).
const V = DB_URL_VARS.local;

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
    vi.stubEnv("DB_TARGET", "local");
    vi.stubEnv(V.rw, LOCAL);
    vi.stubEnv(V.ro, undefined);
    vi.stubEnv(V.app, undefined);
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
    vi.stubEnv(V.ro, "mysql://bg_db_ro:pw@127.0.0.1:3306/app_dev");
    const { isLocalAuthBypass } = await load();
    expect(isLocalAuthBypass()).toBe(true);
  });

  it("refuses when the read-write URL points at Oracle, warning once", async () => {
    vi.stubEnv("AUTH_BYPASS", "true");
    vi.stubEnv(V.rw, ORACLE);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { isLocalAuthBypass } = await load();
    expect(isLocalAuthBypass()).toBe(false);
    expect(isLocalAuthBypass()).toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("refuses when the read-write URL is missing", async () => {
    vi.stubEnv("AUTH_BYPASS", "true");
    vi.stubEnv(V.rw, undefined);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { isLocalAuthBypass } = await load();
    expect(isLocalAuthBypass()).toBe(false);
  });

  it("refuses when the read-only URL points at Oracle", async () => {
    vi.stubEnv("AUTH_BYPASS", "true");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubEnv(V.ro, ORACLE);
    expect((await load()).isLocalAuthBypass()).toBe(false);
  });

  it("refuses when the app URL points at Oracle, and allows a local or empty one", async () => {
    vi.stubEnv("AUTH_BYPASS", "true");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubEnv(V.app, "mysql://bg_db_app:pw@203.0.113.7:3306/backgammon?ssl=true");
    expect((await load()).isLocalAuthBypass()).toBe(false);
    vi.stubEnv(V.app, LOCAL);
    expect((await load()).isLocalAuthBypass()).toBe(true);
    vi.stubEnv(V.app, "");
    expect((await load()).isLocalAuthBypass()).toBe(true);
  });

  it("refuses when DB_TARGET is oracle, even with local URLs", async () => {
    vi.stubEnv("AUTH_BYPASS", "true");
    vi.stubEnv("DB_TARGET", "oracle");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect((await load()).isLocalAuthBypass()).toBe(false);
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
    // Acts as owner in memory, but its row is stored as NONE: the database
    // allows one OWNER row, and that is the real Clerk owner's.
    expect(localBypassIdentity().storedRole).toBe("NONE");
    vi.stubEnv("AUTH_BYPASS_ROLE", "owner");
    expect(localBypassIdentity().role).toBe("OWNER");
  });

  it("is a separate member user with AUTH_BYPASS_ROLE=member", async () => {
    vi.stubEnv("AUTH_BYPASS_ROLE", "member");
    const { localBypassIdentity, LOCAL_DEV_MEMBER_CLERK_ID, LOCAL_DEV_OWNER_CLERK_ID } = await load();
    const identity = localBypassIdentity();
    expect(identity).toMatchObject({ clerkUserId: LOCAL_DEV_MEMBER_CLERK_ID, role: "MEMBER", storedRole: "MEMBER" });
    expect(identity.clerkUserId).not.toBe(LOCAL_DEV_OWNER_CLERK_ID);
  });
});
