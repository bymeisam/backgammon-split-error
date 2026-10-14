// scripts/retryFailedCli.ts: argument parsing, the DB-target line, and that
// --dry-run reads the DB only (no sync run, no Galaxy client, no token).
// lib/sync and Prisma are mocked; no DB or network.
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  runDbOnlySync: vi.fn(),
  selectRetryCandidates: vi.fn(),
  findFirst: vi.fn(async (): Promise<object | null> => ({ id: 1 })),
  count: vi.fn(async () => 0),
  disconnect: vi.fn(async () => {}),
}));

vi.mock("../lib/sync", () => ({
  runDbOnlySync: h.runDbOnlySync,
  selectRetryCandidates: h.selectRetryCandidates,
  MissingSelfIdentityError: class extends Error {},
}));
vi.mock("../lib/prisma", () => ({
  prisma: {
    playerIdentity: { findFirst: h.findFirst },
    match: { count: h.count },
    $disconnect: h.disconnect,
  },
}));
vi.mock("../lib/errorLog", () => ({ SYNC_ERROR_LOG_RELATIVE_PATH: "logs/sync-errors.log" }));

import { describeDatabaseUrl, parseRetryArgs, runRetryFailedFromCli } from "./retryFailedCli";

describe("parseRetryArgs", () => {
  it("defaults to limit 10, all matches, real run", () => {
    expect(parseRetryArgs([])).toEqual({ limit: 10, matchIds: undefined, dryRun: false });
  });

  it("reads --limit, --dry-run and repeated --match lists", () => {
    expect(parseRetryArgs(["--limit", "3", "--match", "11", "12", "--dry-run", "--match", "13"])).toEqual({
      limit: 3,
      matchIds: ["11", "12", "13"],
      dryRun: true,
    });
  });

  it("rejects a bad limit, an empty --match and unknown arguments", () => {
    expect(parseRetryArgs(["--limit", "0"])).toHaveProperty("error");
    expect(parseRetryArgs(["--limit", "x"])).toHaveProperty("error");
    expect(parseRetryArgs(["--limit"])).toHaveProperty("error");
    expect(parseRetryArgs(["--match", "--dry-run"])).toHaveProperty("error");
    expect(parseRetryArgs(["--force"])).toHaveProperty("error");
  });
});

describe("describeDatabaseUrl", () => {
  it("gives host and database only, and flags non-local hosts", () => {
    expect(describeDatabaseUrl("mysql://user:secret@localhost:3306/bg")).toEqual({
      host: "localhost",
      database: "bg",
      isLocal: true,
    });
    const remote = describeDatabaseUrl("mysql://user:secret@db.example.com:3306/backgammon?ssl=true");
    expect(remote).toEqual({ host: "db.example.com", database: "backgammon", isLocal: false });
    expect(JSON.stringify(remote)).not.toContain("secret");
    expect(describeDatabaseUrl(undefined)).toBeNull();
  });
});

describe("runRetryFailedFromCli", () => {
  let logs: string[];

  beforeEach(() => {
    vi.clearAllMocks();
    process.exitCode = undefined;
    logs = [];
    vi.spyOn(console, "log").mockImplementation((...a: unknown[]) => void logs.push(a.join(" ")));
    vi.spyOn(console, "error").mockImplementation((...a: unknown[]) => void logs.push(a.join(" ")));
  });

  it("--dry-run lists the candidates up to the limit without a token or a sync run", async () => {
    h.selectRetryCandidates.mockResolvedValue({
      toIngest: [
        { sourceMatchId: "3", ingestStatus: "FAILED", ingestError: "x".repeat(200) },
        { sourceMatchId: "2", ingestStatus: "PENDING", ingestError: null },
        { sourceMatchId: "1", ingestStatus: "FAILED", ingestError: "boom" },
      ],
      skipped: [{ sourceMatchId: "9", reason: "not found" }],
    });

    await runRetryFailedFromCli(["--dry-run", "--limit", "2"], {
      DATABASE_URL: "mysql://u:p@db.example.com:3306/backgammon",
    });

    expect(h.runDbOnlySync).not.toHaveBeenCalled();
    expect(process.exitCode).toBeUndefined();
    const out = logs.join("\n");
    expect(out).toContain("Target DB: host db.example.com, database backgammon");
    expect(out).toContain("This writes to a remote DB (host db.example.com)");
    expect(out).not.toContain("u:p");
    expect(out).toContain(`  3  FAILED  ${"x".repeat(80)}\n`);
    expect(out).toContain("  2  PENDING");
    expect(out).not.toContain("  1  FAILED");
    expect(out).toContain("match 9: not found");
    expect(h.disconnect).toHaveBeenCalled();
  });

  it("a real run needs GALAXY_TOKEN and starts nothing without it", async () => {
    await runRetryFailedFromCli([], { DATABASE_URL: "mysql://u:p@localhost:3306/bg" });

    expect(h.runDbOnlySync).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
    process.exitCode = undefined;
  });

  it("a real run passes the limit, match ids and the 5 s pause", async () => {
    h.runDbOnlySync.mockResolvedValue({
      syncRunId: 1,
      candidates: 1,
      matchesProcessed: 1,
      matchesSynced: 1,
      matchesFailed: 0,
      detailAlreadyDone: 5,
      stillPending: 0,
      errors: [],
      rateLimitNote: null,
      skipped: [],
    });

    await runRetryFailedFromCli(["--limit", "4", "--match", "77"], {
      DATABASE_URL: "mysql://u:p@localhost:3306/bg",
      GALAXY_TOKEN: "t",
    });

    expect(h.runDbOnlySync).toHaveBeenCalledWith({
      token: "t",
      matchIds: ["77"],
      maxMatchesToProcess: 4,
      pauseBetweenMatchesMs: 5000,
    });
    expect(logs.join("\n")).not.toContain("remote DB");
  });
});
