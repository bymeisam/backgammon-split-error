import { beforeEach, describe, expect, it, vi } from "vitest";

const { latestFinishedSyncRun, sourceLibrary } = vi.hoisted(() => ({
  latestFinishedSyncRun: vi.fn(),
  sourceLibrary: vi.fn(),
}));
vi.mock("@/lib/dashboardQueries", () => ({ latestFinishedSyncRun, sourceLibrary }));

import { SOURCES, galaxyStatus } from "./sources";
import { formatDateTime } from "./formatDate";

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
  const finishedAt = new Date(2026, 9, 4, 9, 5, 0);
  const latestPlayedAt = new Date(2026, 9, 5, 14, 32, 0);
  // Braces: a function returned from beforeEach is run as its teardown.
  beforeEach(() => {
    latestFinishedSyncRun.mockReset();
    sourceLibrary.mockReset();
  });

  it("gives the last sync, what it added and the library", async () => {
    latestFinishedSyncRun.mockResolvedValue({ finishedAt, matchesSynced: 28 });
    sourceLibrary.mockResolvedValue({ matches: 4381, latestPlayedAt });
    expect(await galaxyStatus(now)).toEqual({
      items: [
        { label: "Last sync", value: "4 days ago", detail: formatDateTime(finishedAt) },
        { label: "Last sync added", value: "28 matches" },
        { label: "In library", value: "4,381 matches" },
        { label: "Latest match", value: "5 Oct 2026" },
      ],
    });
    expect(formatDateTime(finishedAt)).toBe("4 Oct 2026, 09:05");
    expect(sourceLibrary).toHaveBeenCalledWith("galaxy");
  });

  it("says one match in the singular", async () => {
    latestFinishedSyncRun.mockResolvedValue({ finishedAt, matchesSynced: 1 });
    sourceLibrary.mockResolvedValue({ matches: 1, latestPlayedAt });
    const { items } = await galaxyStatus(now);
    expect(items.find((i) => i.label === "Last sync added")?.value).toBe("1 match");
    expect(items.find((i) => i.label === "In library")?.value).toBe("1 match");
  });

  it("says no new matches when the last sync added none", async () => {
    latestFinishedSyncRun.mockResolvedValue({ finishedAt, matchesSynced: 0 });
    sourceLibrary.mockResolvedValue({ matches: 12, latestPlayedAt });
    const { items } = await galaxyStatus(now);
    expect(items.find((i) => i.label === "Last sync added")?.value).toBe("No new matches");
  });

  it("says never, with no added item, without a finished run", async () => {
    latestFinishedSyncRun.mockResolvedValue(null);
    sourceLibrary.mockResolvedValue({ matches: 0, latestPlayedAt: null });
    expect(await galaxyStatus(now)).toEqual({ items: [{ label: "Last sync", value: "Never" }] });
  });

  it("reads unknown, with no added item, when the sync lookup fails; the library still shows", async () => {
    latestFinishedSyncRun.mockRejectedValue(new Error("db down"));
    sourceLibrary.mockResolvedValue({ matches: 3, latestPlayedAt });
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await galaxyStatus(now)).toEqual({
      items: [
        { label: "Last sync", value: "Unknown" },
        { label: "In library", value: "3 matches" },
        { label: "Latest match", value: "5 Oct 2026" },
      ],
    });
    quiet.mockRestore();
  });

  it("hides the library items at 0 DONE matches", async () => {
    latestFinishedSyncRun.mockResolvedValue({ finishedAt, matchesSynced: 0 });
    sourceLibrary.mockResolvedValue({ matches: 0, latestPlayedAt: null });
    const labels = (await galaxyStatus(now)).items.map((i) => i.label);
    expect(labels).toEqual(["Last sync", "Last sync added"]);
  });

  it("hides the library items, and keeps the sync ones, when the library lookup fails", async () => {
    latestFinishedSyncRun.mockResolvedValue({ finishedAt, matchesSynced: 2 });
    sourceLibrary.mockRejectedValue(new Error("db down"));
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    const labels = (await galaxyStatus(now)).items.map((i) => i.label);
    expect(labels).toEqual(["Last sync", "Last sync added"]);
    quiet.mockRestore();
  });

  it("drops only LATEST MATCH when no DONE match has a played date", async () => {
    latestFinishedSyncRun.mockResolvedValue({ finishedAt, matchesSynced: 2 });
    sourceLibrary.mockResolvedValue({ matches: 1, latestPlayedAt: null });
    const labels = (await galaxyStatus(now)).items.map((i) => i.label);
    expect(labels).toEqual(["Last sync", "Last sync added", "In library"]);
  });

  it("runs both lookups in parallel", async () => {
    let resolveRun: (v: null) => void = () => {};
    latestFinishedSyncRun.mockReturnValue(new Promise((r) => (resolveRun = r)));
    sourceLibrary.mockResolvedValue({ matches: 0, latestPlayedAt: null });
    const pending = galaxyStatus(now);
    // The library lookup has started before the sync lookup settles.
    expect(sourceLibrary).toHaveBeenCalledTimes(1);
    resolveRun(null);
    await pending;
  });
});
