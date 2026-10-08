import { afterEach, describe, expect, it, vi } from "vitest";
import { currentRuntimeModeLabel, isLocalDatabaseUrl, runtimeModeLabel } from "./runtimeMode";

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

  it("is false when unset, empty or unparseable", () => {
    expect(isLocalDatabaseUrl(undefined)).toBe(false);
    expect(isLocalDatabaseUrl("")).toBe(false);
    expect(isLocalDatabaseUrl("not a url")).toBe(false);
  });
});

describe("runtimeModeLabel", () => {
  it("reads Read-only whenever write mode is off, whatever the URL", () => {
    expect(runtimeModeLabel({ writeEnabled: false, databaseUrl: undefined })).toBe("Read-only");
    expect(runtimeModeLabel({ writeEnabled: false, databaseUrl: "mysql://u:p@localhost/db" })).toBe("Read-only");
    expect(runtimeModeLabel({ writeEnabled: false, databaseUrl: "mysql://u:p@203.0.113.7/db" })).toBe("Read-only");
  });

  it("reads Local · write for a local host", () => {
    expect(runtimeModeLabel({ writeEnabled: true, databaseUrl: "mysql://u:p@localhost:3306/app_dev" })).toBe(
      "Local · write"
    );
    expect(runtimeModeLabel({ writeEnabled: true, databaseUrl: "mysql://u:p@127.0.0.1:3306/app_dev" })).toBe(
      "Local · write"
    );
  });

  it("reads Oracle · write for any other host, or a URL that doesn't parse", () => {
    expect(
      runtimeModeLabel({ writeEnabled: true, databaseUrl: "mysql://u:p@203.0.113.7:3306/backgammon?ssl=true" })
    ).toBe("Oracle · write");
    expect(runtimeModeLabel({ writeEnabled: true, databaseUrl: "garbage" })).toBe("Oracle · write");
  });

  it("never includes the URL, host or credentials in the label", () => {
    const url = "mysql://secret_user:secret_pw@203.0.113.7:3306/backgammon?ssl=true";
    const label = runtimeModeLabel({ writeEnabled: true, databaseUrl: url });
    for (const part of ["secret_user", "secret_pw", "203.0.113.7", "backgammon", "3306"]) {
      expect(label).not.toContain(part);
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

  it("follows the env's host in write mode", () => {
    vi.stubEnv("ENABLE_WRITE_MODE", "true");
    vi.stubEnv("DATABASE_URL", "mysql://u:p@127.0.0.1:3306/app_dev");
    expect(currentRuntimeModeLabel()).toBe("Local · write");
    vi.stubEnv("DATABASE_URL", "mysql://u:p@203.0.113.7:3306/backgammon?ssl=true");
    expect(currentRuntimeModeLabel()).toBe("Oracle · write");
  });
});
