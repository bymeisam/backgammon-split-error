import { describe, expect, it } from "vitest";
import { forumDatabaseUrl } from "./prisma";

const FORUM = "mysql://bg_db_forum:pw@203.0.113.7:3306/backgammon?ssl=true";
const ADMIN = "mysql://bg_db_rw:pw@203.0.113.7:3306/backgammon?ssl=true";

function env(vars: Record<string, string | undefined>): NodeJS.ProcessEnv {
  return vars as NodeJS.ProcessEnv;
}

describe("forumDatabaseUrl", () => {
  it("uses DATABASE_URL_FORUM when set, in any environment", () => {
    expect(forumDatabaseUrl(env({ NODE_ENV: "production", DATABASE_URL_FORUM: FORUM, DATABASE_URL: ADMIN }))).toBe(FORUM);
    expect(forumDatabaseUrl(env({ NODE_ENV: "development", DATABASE_URL_FORUM: FORUM, DATABASE_URL: ADMIN }))).toBe(FORUM);
  });

  it("falls back to DATABASE_URL outside production", () => {
    expect(forumDatabaseUrl(env({ NODE_ENV: "development", DATABASE_URL: ADMIN }))).toBe(ADMIN);
    expect(forumDatabaseUrl(env({ NODE_ENV: "test", DATABASE_URL: ADMIN }))).toBe(ADMIN);
  });

  it("never falls back to the admin DATABASE_URL in production", () => {
    expect(forumDatabaseUrl(env({ NODE_ENV: "production", DATABASE_URL: ADMIN }))).toBeUndefined();
  });
});
