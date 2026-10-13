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
    vi.stubEnv("DATABASE_URL_AUTH", undefined);
    vi.stubEnv("DATABASE_URL_READONLY", undefined);
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

  it("refuses when the auth or read-only URL points at Oracle", async () => {
    vi.stubEnv("AUTH_BYPASS", "true");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubEnv("DATABASE_URL_AUTH", ORACLE);
    expect((await load()).isLocalAuthBypass()).toBe(false);
    vi.stubEnv("DATABASE_URL_AUTH", undefined);
    vi.stubEnv("DATABASE_URL_READONLY", ORACLE);
    expect((await load()).isLocalAuthBypass()).toBe(false);
  });
});
