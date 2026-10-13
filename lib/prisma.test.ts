import { describe, expect, it } from "vitest";
import { appDatabaseUrl } from "./prisma";

const APP = "mysql://bg_db_app:pw@203.0.113.7:3306/backgammon?ssl=true";
const ADMIN = "mysql://bg_db_rw:pw@203.0.113.7:3306/backgammon?ssl=true";

function env(vars: Record<string, string | undefined>): NodeJS.ProcessEnv {
  return vars as NodeJS.ProcessEnv;
}

describe("appDatabaseUrl", () => {
  it("uses DATABASE_URL_APP when set, in any environment", () => {
    expect(appDatabaseUrl(env({ NODE_ENV: "production", DATABASE_URL_APP: APP, DATABASE_URL: ADMIN }))).toBe(APP);
    expect(appDatabaseUrl(env({ NODE_ENV: "development", DATABASE_URL_APP: APP, DATABASE_URL: ADMIN }))).toBe(APP);
  });

  it("falls back to DATABASE_URL outside production", () => {
    expect(appDatabaseUrl(env({ NODE_ENV: "development", DATABASE_URL: ADMIN }))).toBe(ADMIN);
    expect(appDatabaseUrl(env({ NODE_ENV: "test", DATABASE_URL: ADMIN }))).toBe(ADMIN);
  });

  it("treats an empty DATABASE_URL_APP as unset", () => {
    expect(appDatabaseUrl(env({ NODE_ENV: "development", DATABASE_URL_APP: "", DATABASE_URL: ADMIN }))).toBe(ADMIN);
    expect(appDatabaseUrl(env({ NODE_ENV: "production", DATABASE_URL_APP: "", DATABASE_URL: ADMIN }))).toBeUndefined();
  });

  it("never falls back to the admin DATABASE_URL in production", () => {
    expect(appDatabaseUrl(env({ NODE_ENV: "production", DATABASE_URL: ADMIN }))).toBeUndefined();
  });

  it("is undefined when nothing is set", () => {
    expect(appDatabaseUrl(env({ NODE_ENV: "development" }))).toBeUndefined();
  });
});
