import { describe, expect, it } from "vitest";
import { appDatabaseUrl } from "./prisma";
import { DB_URL_VARS } from "./databaseUrl";

const APP = "mysql://bg_db_app:pw@203.0.113.7:3306/backgammon?ssl=true";
const ADMIN = "mysql://bg_db_rw:pw@203.0.113.7:3306/backgammon?ssl=true";

// Target-agnostic: run every case against both URL sets.
describe.each([["local"], ["oracle"]] as const)("appDatabaseUrl (DB_TARGET=%s)", (target) => {
  const V = DB_URL_VARS[target];
  function env(vars: { NODE_ENV: string; app?: string; rw?: string }): NodeJS.ProcessEnv {
    return { DB_TARGET: target, NODE_ENV: vars.NODE_ENV, [V.app]: vars.app, [V.rw]: vars.rw } as NodeJS.ProcessEnv;
  }

  it("uses the app URL when set, in any environment", () => {
    expect(appDatabaseUrl(env({ NODE_ENV: "production", app: APP, rw: ADMIN }))).toBe(APP);
    expect(appDatabaseUrl(env({ NODE_ENV: "development", app: APP, rw: ADMIN }))).toBe(APP);
  });

  it("falls back to the read-write URL outside production", () => {
    expect(appDatabaseUrl(env({ NODE_ENV: "development", rw: ADMIN }))).toBe(ADMIN);
    expect(appDatabaseUrl(env({ NODE_ENV: "test", rw: ADMIN }))).toBe(ADMIN);
  });

  it("treats an empty app URL as unset", () => {
    expect(appDatabaseUrl(env({ NODE_ENV: "development", app: "", rw: ADMIN }))).toBe(ADMIN);
    expect(appDatabaseUrl(env({ NODE_ENV: "production", app: "", rw: ADMIN }))).toBeUndefined();
  });

  it("never falls back to the admin read-write URL in production", () => {
    expect(appDatabaseUrl(env({ NODE_ENV: "production", rw: ADMIN }))).toBeUndefined();
  });

  it("is undefined when nothing is set", () => {
    expect(appDatabaseUrl(env({ NODE_ENV: "development" }))).toBeUndefined();
  });
});
