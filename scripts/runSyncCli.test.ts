// scripts/runSyncCli.ts (backfill and incremental): argument parsing, the
// pacing and DB-target line passed to a real run, and --dry-run's report.
// lib/sync and Prisma are mocked; no DB or network.
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  runSync: vi.fn(),
  count: vi.fn(async () => 0),
  disconnect: vi.fn(async () => {}),
}));

vi.mock("../lib/sync", () => ({ runSync: h.runSync }));
vi.mock("../lib/prisma", () => ({
  prisma: { match: { count: h.count }, $disconnect: h.disconnect },
}));
vi.mock("../lib/errorLog", () => ({ SYNC_ERROR_LOG_RELATIVE_PATH: "logs/sync-errors.log" }));

import { parseSyncArgs, runSyncFromCli } from "./runSyncCli";

const REMOTE = { DATABASE_URL: "mysql://u:p@db.example.com:3306/backgammon", GALAXY_TOKEN: "t" };
const LOCAL = { DATABASE_URL: "mysql://u:p@localhost:3306/bg", GALAXY_TOKEN: "t" };

describe("parseSyncArgs", () => {
  it("defaults to no limit and a real run", () => {
    expect(parseSyncArgs([])).toEqual({ limit: undefined, matchIds: undefined, dryRun: false });
  });

  it("reads --limit and --dry-run", () => {
    expect(parseSyncArgs(["--limit", "5", "--dry-run"])).toEqual({ limit: 5, matchIds: undefined, dryRun: true });
  });

  it("rejects --match, a bad limit and unknown flags", () => {
    expect(parseSyncArgs(["--match", "123"])).toEqual({ error: "Unknown argument: --match" });
    expect(parseSyncArgs(["--limit", "0"])).toHaveProperty("error");
    expect(parseSyncArgs(["--limit"])).toHaveProperty("error");
    expect(parseSyncArgs(["--force"])).toEqual({ error: "Unknown argument: --force" });
  });
});

describe("runSyncFromCli", () => {
  let logs: string[];

  beforeEach(() => {
    vi.clearAllMocks();
    process.exitCode = undefined;
    logs = [];
    vi.spyOn(console, "log").mockImplementation((...a: unknown[]) => void logs.push(a.join(" ")));
    vi.spyOn(console, "error").mockImplementation((...a: unknown[]) => void logs.push(a.join(" ")));
  });

  it.each([
    ["BACKFILL", "sync:backfill"],
    ["INCREMENTAL", "sync:incremental"],
  ] as const)("%s: --match and unknown flags are errors and start nothing", async (type, npmScript) => {
    await runSyncFromCli(type, ["--match", "1"], LOCAL);
    expect(process.exitCode).toBe(1);
    expect(logs.join("\n")).toContain(`npm run ${npmScript} -- [--limit N] [--dry-run]`);

    process.exitCode = undefined;
    await runSyncFromCli(type, ["--nope"], LOCAL);
    expect(process.exitCode).toBe(1);
    expect(h.runSync).not.toHaveBeenCalled();
    process.exitCode = undefined;
  });

  it("a real run passes the pauses, the log and no limit by default, and names the DB host", async () => {
    h.runSync.mockResolvedValue({
      syncRunId: 1,
      matchesFound: 3,
      matchesProcessed: 1,
      matchesSynced: 1,
      matchesFailed: 0,
      detailAlreadyDone: 2,
      stillPending: 0,
      errors: [],
      rateLimitNote: null,
    });

    await runSyncFromCli("INCREMENTAL", [], REMOTE);

    expect(h.runSync).toHaveBeenCalledTimes(1);
    const call = h.runSync.mock.calls[0][0];
    expect(call).toMatchObject({
      token: "t",
      type: "INCREMENTAL",
      maxMatchesToProcess: undefined,
      pauseBetweenMatchesMs: 5000,
      pauseBetweenPagesMs: 1500,
    });
    expect(call.dryRun).toBeUndefined();
    expect(typeof call.log).toBe("function");
    const out = logs.join("\n");
    expect(out).toContain("Target DB: host db.example.com, database backgammon");
    expect(out).toContain("This writes to a remote DB (host db.example.com)");
    expect(out).not.toContain("u:p");
    expect(out).toContain("INCREMENTAL sync complete:");
    expect(h.disconnect).toHaveBeenCalled();
  });

  it("--limit reaches runSync for a backfill", async () => {
    h.runSync.mockResolvedValue({ errors: [], rateLimitNote: null });

    await runSyncFromCli("BACKFILL", ["--limit", "7"], LOCAL);

    expect(h.runSync.mock.calls[0][0]).toMatchObject({ type: "BACKFILL", maxMatchesToProcess: 7 });
    expect(logs.join("\n")).not.toContain("remote DB");
  });

  it("--dry-run asks runSync for a dry run and prints the new and pending counts", async () => {
    h.runSync.mockResolvedValue({
      dryRun: true,
      type: "INCREMENTAL",
      pagesWalked: 2,
      totalPages: 140,
      matchesSeen: 60,
      newMatchIds: ["900"],
      pendingExisting: [{ sourceMatchId: "800", ingestStatus: "FAILED", ingestError: "boom" }],
      wouldIngestTotal: 2,
      wouldIngest: ["900"],
      rateLimitNote: null,
    });

    await runSyncFromCli("INCREMENTAL", ["--dry-run", "--limit", "1"], LOCAL);

    expect(h.runSync.mock.calls[0][0]).toMatchObject({ dryRun: true, maxMatchesToProcess: 1, pauseBetweenPagesMs: 1500 });
    expect(h.count).not.toHaveBeenCalled();
    const out = logs.join("\n");
    expect(out).toContain("Pages walked: 2 of 140");
    expect(out).toContain("Matches seen: 60");
    expect(out).toContain("Would be new (not in the DB): 1");
    expect(out).toContain("Existing non-DONE matches: 1");
    expect(out).toContain("Would ingest 1 of 2 (limit 1, 5000 ms pause between matches):");
    expect(out).toContain("  900  new");
    expect(out).not.toContain("  800  FAILED");
  });
});
