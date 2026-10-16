import { describe, expect, it } from "vitest";
import {
  DB_URL_VARS,
  dbTarget,
  dbUrl,
  dbUrlVarName,
  isLocalTarget,
  localDbUrl,
  targetDbUrl,
} from "./databaseUrl";

const L = DB_URL_VARS.local;
const O = DB_URL_VARS.oracle;

const LOCAL_RW = "mysql://app:app@localhost:3306/app_dev";
const LOCAL_RO = "mysql://bg_db_ro:pw@127.0.0.1:3306/app_dev";
const LOCAL_APP = "mysql://bg_db_app:pw@[::1]:3306/app_dev";
const ORACLE_RW = "mysql://bg_db_rw:pw@203.0.113.7:3306/backgammon?ssl=true";
const ORACLE_RO = "mysql://bg_db_ro:pw@203.0.113.7:3306/backgammon?ssl=true";
const ORACLE_APP = "mysql://bg_db_app:pw@203.0.113.7:3306/backgammon?ssl=true";

// Both URL sets present, as in the user's .env.
function env(extra: Record<string, string | undefined> = {}): Record<string, string | undefined> {
  return {
    [L.rw]: LOCAL_RW,
    [L.ro]: LOCAL_RO,
    [L.app]: LOCAL_APP,
    [O.rw]: ORACLE_RW,
    [O.ro]: ORACLE_RO,
    [O.app]: ORACLE_APP,
    ...extra,
  };
}

describe("dbTarget", () => {
  it("defaults to local when DB_TARGET is unset or empty", () => {
    expect(dbTarget(env())).toBe("local");
    expect(dbTarget(env({ DB_TARGET: "" }))).toBe("local");
    expect(dbTarget(env({ DB_TARGET: "local" }))).toBe("local");
  });

  it("is oracle only for exactly \"oracle\"", () => {
    expect(dbTarget(env({ DB_TARGET: "oracle" }))).toBe("oracle");
  });

  it("throws a clear error on any other value", () => {
    for (const bad of ["Oracle", "ORACLE", "prod", "remote", " local", "1"]) {
      expect(() => dbTarget(env({ DB_TARGET: bad }))).toThrow(/DB_TARGET must be "local" or "oracle"/);
    }
    expect(() => dbUrl("rw", env({ DB_TARGET: "prod" }))).toThrow(/DB_TARGET/);
  });
});

describe("dbUrl", () => {
  it("reads the LOCAL_* set by default", () => {
    expect(dbUrl("rw", env())).toBe(LOCAL_RW);
    expect(dbUrl("ro", env())).toBe(LOCAL_RO);
    expect(dbUrl("app", env())).toBe(LOCAL_APP);
    expect(dbUrlVarName("rw", env())).toBe(L.rw);
  });

  it("reads the Oracle set under DB_TARGET=oracle", () => {
    const e = env({ DB_TARGET: "oracle" });
    expect(dbUrl("rw", e)).toBe(ORACLE_RW);
    expect(dbUrl("ro", e)).toBe(ORACLE_RO);
    expect(dbUrl("app", e)).toBe(ORACLE_APP);
    expect(dbUrlVarName("app", e)).toBe(O.app);
  });

  it("never reads the Oracle set under the local target, even when the local one is missing", () => {
    const e = env({ [L.rw]: undefined, [L.ro]: "", [L.app]: undefined });
    expect(dbUrl("rw", e)).toBeUndefined();
    expect(dbUrl("ro", e)).toBeUndefined();
    expect(dbUrl("app", e)).toBeUndefined();
  });

  it("treats an empty URL as unset", () => {
    expect(targetDbUrl("oracle", "ro", env({ [O.ro]: "" }))).toBeUndefined();
  });
});

describe("localDbUrl", () => {
  it("returns the LOCAL_* URL whatever DB_TARGET says", () => {
    for (const DB_TARGET of [undefined, "", "local", "oracle"]) {
      expect(localDbUrl("rw", env({ DB_TARGET }))).toBe(LOCAL_RW);
      expect(localDbUrl("ro", env({ DB_TARGET }))).toBe(LOCAL_RO);
      expect(localDbUrl("app", env({ DB_TARGET }))).toBe(LOCAL_APP);
    }
  });

  it("doesn't throw on an invalid DB_TARGET", () => {
    expect(localDbUrl("rw", env({ DB_TARGET: "prod" }))).toBe(LOCAL_RW);
  });
});

describe("isLocalTarget", () => {
  it("is true for the local target with localhost URLs", () => {
    expect(isLocalTarget(env())).toBe(true);
    expect(isLocalTarget(env({ [L.ro]: undefined, [L.app]: "" }))).toBe(true);
  });

  it("is false under DB_TARGET=oracle, whatever the URLs", () => {
    expect(isLocalTarget(env({ DB_TARGET: "oracle" }))).toBe(false);
    expect(isLocalTarget(env({ DB_TARGET: "oracle", [O.rw]: LOCAL_RW, [O.ro]: LOCAL_RO, [O.app]: LOCAL_APP }))).toBe(false);
  });

  it("is false for the local target with a non-localhost URL", () => {
    expect(isLocalTarget(env({ [L.rw]: ORACLE_RW }))).toBe(false);
    expect(isLocalTarget(env({ [L.ro]: ORACLE_RO }))).toBe(false);
    expect(isLocalTarget(env({ [L.app]: "mysql://u:p@localhost.example.com/db" }))).toBe(false);
  });

  it("is false when the read-write URL is missing or unparseable", () => {
    expect(isLocalTarget(env({ [L.rw]: undefined }))).toBe(false);
    expect(isLocalTarget(env({ [L.rw]: "not a url" }))).toBe(false);
  });

  it("is false (not a throw) on an invalid DB_TARGET", () => {
    expect(isLocalTarget(env({ DB_TARGET: "prod" }))).toBe(false);
  });
});
