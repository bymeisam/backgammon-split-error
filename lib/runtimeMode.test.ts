import { afterEach, describe, expect, it, vi } from "vitest";
import { currentRuntimeModeLabel, databaseClass, isLocalDatabaseUrl, runtimeModeLabel } from "./runtimeMode";

describe("isLocalDatabaseUrl", () => {
  it("is true for localhost and 127.0.0.1", () => {
    expect(isLocalDatabaseUrl("mysql://bg_db_rw:pw@localhost:3306/app_dev")).toBe(true);
    expect(isLocalDatabaseUrl("mysql://bg_db_rw:pw@127.0.0.1:3306/app_dev")).toBe(true);
    expect(isLocalDatabaseUrl("mysql://app@localhost/app_dev")).toBe(true);
  });

  it("is false for any other host", () => {
    expect(isLocalDatabaseUrl("mysql://bg_db_rw:pw@203.0.113.7:3306/backgammon?ssl=true")).toBe(false);
    expect(isLocalDatabaseUrl("mysql://u:p@db.example.com:3306/backgammon")).toBe(false);
    // A host that only contains "localhost" isn't local.
    expect(isLocalDatabaseUrl("mysql://u:p@localhost.example.com/db")).toBe(false);
    // The credentials don't count, only the host.
    expect(isLocalDatabaseUrl("mysql://localhost:127.0.0.1@203.0.113.7/db")).toBe(false);
  });

  it("is true for IPv6 loopback, with or without brackets", () => {
    expect(isLocalDatabaseUrl("mysql://u:p@[::1]:3306/app_dev")).toBe(true);
    expect(isLocalDatabaseUrl("mysql://u:p@[::1]/app_dev")).toBe(true);
  });

  it("compares the host case-insensitively", () => {
    expect(isLocalDatabaseUrl("mysql://u:p@LOCALHOST:3306/app_dev")).toBe(true);
    expect(isLocalDatabaseUrl("mysql://u:p@LocalHost/app_dev")).toBe(true);
  });

  it("ignores a password or user that contains localhost", () => {
    expect(isLocalDatabaseUrl("mysql://u:localhost@10.0.0.1:3306/db")).toBe(false);
    expect(isLocalDatabaseUrl("mysql://u:my-localhost-pw@10.0.0.1:3306/db")).toBe(false);
  });

  it("classes a Docker service name as not local (the safe direction)", () => {
    expect(isLocalDatabaseUrl("mysql://u:p@db:3306/app_dev")).toBe(false);
  });

  it("is false when unset, empty or unparseable", () => {
    expect(isLocalDatabaseUrl(undefined)).toBe(false);
    expect(isLocalDatabaseUrl("")).toBe(false);
    expect(isLocalDatabaseUrl("not a url")).toBe(false);
  });
});

describe("databaseClass", () => {
  it("is Local for a local host and Oracle for anything else, missing or unparseable", () => {
    expect(databaseClass("mysql://u:p@localhost/db")).toBe("Local");
    expect(databaseClass("mysql://u:p@[::1]/db")).toBe("Local");
    expect(databaseClass("mysql://u:p@203.0.113.7/db")).toBe("Oracle");
    expect(databaseClass(undefined)).toBe("Oracle");
    expect(databaseClass("")).toBe("Oracle");
    expect(databaseClass("garbage")).toBe("Oracle");
  });
});

const LOCAL = "mysql://u:p@localhost:3306/app_dev";
const LOCAL_IP = "mysql://u:p@127.0.0.1:3306/app_dev";
const ORACLE = "mysql://u:p@203.0.113.7:3306/backgammon?ssl=true";

describe("runtimeModeLabel", () => {
  it("reads Read-only whenever write mode is off, whatever the URLs", () => {
    for (const databaseUrl of [undefined, LOCAL, ORACLE, "garbage"]) {
      for (const readOnlyDatabaseUrl of [undefined, LOCAL, ORACLE, "garbage"]) {
        expect(runtimeModeLabel({ writeEnabled: false, databaseUrl, readOnlyDatabaseUrl })).toBe("Read-only");
      }
    }
  });

  it("reads Local · write when both URLs are local", () => {
    expect(runtimeModeLabel({ writeEnabled: true, databaseUrl: LOCAL, readOnlyDatabaseUrl: LOCAL })).toBe(
      "Local · write"
    );
    expect(runtimeModeLabel({ writeEnabled: true, databaseUrl: LOCAL_IP, readOnlyDatabaseUrl: LOCAL })).toBe(
      "Local · write"
    );
  });

  it("reads Oracle · write when both URLs are non-local, missing or unparseable", () => {
    expect(runtimeModeLabel({ writeEnabled: true, databaseUrl: ORACLE, readOnlyDatabaseUrl: ORACLE })).toBe(
      "Oracle · write"
    );
    expect(runtimeModeLabel({ writeEnabled: true, databaseUrl: "garbage", readOnlyDatabaseUrl: ORACLE })).toBe(
      "Oracle · write"
    );
    expect(runtimeModeLabel({ writeEnabled: true, databaseUrl: ORACLE, readOnlyDatabaseUrl: undefined })).toBe(
      "Oracle · write"
    );
    expect(runtimeModeLabel({ writeEnabled: true, databaseUrl: "garbage", readOnlyDatabaseUrl: "" })).toBe(
      "Oracle · write"
    );
  });

  it("shows both when writes go to Oracle and reads come from local", () => {
    expect(runtimeModeLabel({ writeEnabled: true, databaseUrl: ORACLE, readOnlyDatabaseUrl: LOCAL })).toBe(
      "Writes: Oracle · Reads: Local"
    );
    // An unparseable or missing write URL counts as Oracle.
    expect(runtimeModeLabel({ writeEnabled: true, databaseUrl: "garbage", readOnlyDatabaseUrl: LOCAL })).toBe(
      "Writes: Oracle · Reads: Local"
    );
    expect(runtimeModeLabel({ writeEnabled: true, databaseUrl: undefined, readOnlyDatabaseUrl: LOCAL })).toBe(
      "Writes: Oracle · Reads: Local"
    );
  });

  it("shows both when writes go to local and reads come from Oracle", () => {
    expect(runtimeModeLabel({ writeEnabled: true, databaseUrl: LOCAL, readOnlyDatabaseUrl: ORACLE })).toBe(
      "Writes: Local · Reads: Oracle"
    );
    // An unparseable or missing read URL counts as Oracle.
    expect(runtimeModeLabel({ writeEnabled: true, databaseUrl: LOCAL, readOnlyDatabaseUrl: "garbage" })).toBe(
      "Writes: Local · Reads: Oracle"
    );
    expect(runtimeModeLabel({ writeEnabled: true, databaseUrl: LOCAL, readOnlyDatabaseUrl: undefined })).toBe(
      "Writes: Local · Reads: Oracle"
    );
    expect(
      runtimeModeLabel({ writeEnabled: true, databaseUrl: LOCAL, readOnlyDatabaseUrl: "mysql://x:y@10.0.0.1:3306/db" })
    ).toBe("Writes: Local · Reads: Oracle");
  });

  it("never includes either URL, host or credentials in the label", () => {
    const write = "mysql://secret_user:secret_pw@203.0.113.7:3306/backgammon?ssl=true";
    const read = "mysql://ro_user:ro_pw@localhost:3307/app_dev";
    for (const [databaseUrl, readOnlyDatabaseUrl] of [
      [write, read],
      [read, write],
      [write, write],
    ]) {
      const label = runtimeModeLabel({ writeEnabled: true, databaseUrl, readOnlyDatabaseUrl });
      for (const part of ["secret_user", "secret_pw", "203.0.113.7", "backgammon", "3306", "ro_user", "ro_pw", "localhost", "3307", "app_dev", "mysql://"]) {
        expect(label).not.toContain(part);
      }
    }
  });
});

describe("currentRuntimeModeLabel", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is Read-only with no DATABASE_URL (the Vercel read-only site), even with the flag set", () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("ENABLE_WRITE_MODE", "true");
    expect(currentRuntimeModeLabel()).toBe("Read-only");
  });

  it("is Read-only when ENABLE_WRITE_MODE isn't exactly \"true\"", () => {
    vi.stubEnv("DATABASE_URL", "mysql://u:p@localhost/db");
    vi.stubEnv("ENABLE_WRITE_MODE", "1");
    expect(currentRuntimeModeLabel()).toBe("Read-only");
  });

  it("follows both env URLs' hosts in write mode", () => {
    vi.stubEnv("ENABLE_WRITE_MODE", "true");
    vi.stubEnv("DATABASE_URL", LOCAL_IP);
    vi.stubEnv("DATABASE_URL_READONLY", LOCAL);
    expect(currentRuntimeModeLabel()).toBe("Local · write");
    vi.stubEnv("DATABASE_URL_READONLY", ORACLE);
    expect(currentRuntimeModeLabel()).toBe("Writes: Local · Reads: Oracle");
    vi.stubEnv("DATABASE_URL", ORACLE);
    expect(currentRuntimeModeLabel()).toBe("Oracle · write");
    vi.stubEnv("DATABASE_URL_READONLY", LOCAL);
    expect(currentRuntimeModeLabel()).toBe("Writes: Oracle · Reads: Local");
  });
});
