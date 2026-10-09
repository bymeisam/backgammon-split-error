import { beforeEach, describe, expect, it, vi } from "vitest";

const { latestFinishedSyncRun } = vi.hoisted(() => ({ latestFinishedSyncRun: vi.fn() }));
vi.mock("@/lib/dashboardQueries", () => ({ latestFinishedSyncRun }));

import { SOURCES, galaxyStatus } from "./sources";

describe("SOURCES", () => {
  it("has unique ids and links under /sources", () => {
    const ids = SOURCES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const source of SOURCES) {
      for (const link of source.links) expect(link.href.startsWith("/sources/")).toBe(true);
    }
  });

  it("lists Galaxy with its matches link", () => {
    const galaxy = SOURCES.find((s) => s.id === "galaxy");
    expect(galaxy?.links.map((l) => l.href)).toEqual(["/sources/galaxy/matches"]);
  });
});

describe("galaxyStatus", () => {
  const now = new Date(2026, 9, 8, 15, 0, 0);
  // Braces: a function returned from beforeEach is run as its teardown.
  beforeEach(() => {
    latestFinishedSyncRun.mockReset();
  });

  it("says when and how many from the latest finished sync run", async () => {
    const finishedAt = new Date(2026, 9, 4, 9, 0, 0);
    latestFinishedSyncRun.mockResolvedValue({ finishedAt, matchesSynced: 28 });
    expect(await galaxyStatus(now)).toEqual({
      label: "Last synced",
      value: "Synced 4 days ago · 28 matches",
      title: finishedAt.toLocaleString(),
    });
  });

  it("says never without a finished run", async () => {
    latestFinishedSyncRun.mockResolvedValue(null);
    expect(await galaxyStatus(now)).toEqual({ label: "Last synced", value: "Never synced", title: undefined });
  });

  it("reads unknown when the lookup fails", async () => {
    latestFinishedSyncRun.mockRejectedValue(new Error("db down"));
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await galaxyStatus(now)).toEqual({ label: "Last synced", value: "Last sync unknown" });
    quiet.mockRestore();
  });
});
