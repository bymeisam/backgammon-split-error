// lib/sync.ts's run control: stopping detail-ingest cleanly on a Galaxy
// rate limit, and how far each sync type walks the match list. Prisma is an
// in-memory fake of just the calls runSync makes; the Galaxy client and
// ingestMatch are mocked, so there's no DB or network.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AnalysesListResponse, MatchAnalysis } from "@/lib/analysesTypes";
import type { IngestSummary } from "@/lib/ingest";
import { GalaxyRateLimitError } from "@/lib/galaxyRateLimit";

interface FakeMatch {
  id: number;
  sourceMatchId: string;
  ingestStatus: string;
  ingestError: string | null;
}

const h = vi.hoisted(() => {
  const state = { matches: [] as FakeMatch[], nextId: 1 };
  const statusIn = (where: { ingestStatus?: string | { in: string[] } } | undefined, m: FakeMatch) => {
    const s = where?.ingestStatus;
    if (s === undefined) return true;
    return typeof s === "string" ? m.ingestStatus === s : s.in.includes(m.ingestStatus);
  };
  return {
    state,
    listMatches: vi.fn<(page: number) => Promise<AnalysesListResponse>>(),
    ingestMatch: vi.fn<(matchId: number) => Promise<IngestSummary>>(),
    recomputeMistakeStats: vi.fn(async () => {}),
    recomputeRepeatedPositions: vi.fn(async () => {}),
    syncRunUpdate: vi.fn(async () => ({})),
    prisma: {
      syncRun: {
        create: vi.fn(async () => ({ id: 7, startedAt: new Date("2026-10-14T00:00:00Z") })),
        update: undefined as unknown,
      },
      playerIdentity: {
        upsert: vi.fn(async () => ({})),
        findFirst: vi.fn(async (): Promise<object | null> => ({ id: 1, isMe: true })),
      },
      match: {
        findMany: vi.fn(
          async (args: {
            where: { sourceMatchId?: { in: string[] }; ingestStatus?: { in: string[] } };
            orderBy?: unknown;
          }) => {
            const ids = args.where.sourceMatchId?.in;
            const rows = state.matches.filter(
              (m) => (ids ? ids.includes(m.sourceMatchId) : true) && statusIn(args.where, m)
            );
            return ids && !args.orderBy ? rows : [...rows].sort((a, b) => b.id - a.id);
          }
        ),
        upsert: vi.fn(
          async (args: { where: { source_sourceMatchId: { sourceMatchId: string } } }) => {
            const sourceMatchId = args.where.source_sourceMatchId.sourceMatchId;
            let m = state.matches.find((x) => x.sourceMatchId === sourceMatchId);
            if (!m) {
              m = { id: state.nextId++, sourceMatchId, ingestStatus: "PENDING", ingestError: null };
              state.matches.push(m);
            }
            return m;
          }
        ),
        update: vi.fn(async (args: { where: { id: number }; data: Partial<FakeMatch> }) => {
          const m = state.matches.find((x) => x.id === args.where.id)!;
          Object.assign(m, args.data);
          return m;
        }),
        count: vi.fn(
          async (args: { where: { ingestStatus: string | { in: string[] } } }) =>
            state.matches.filter((m) => statusIn(args.where, m)).length
        ),
      },
    },
  };
});
h.prisma.syncRun.update = h.syncRunUpdate;

vi.mock("@/lib/prisma", () => ({ prisma: h.prisma }));
vi.mock("@/lib/galaxy-client", () => ({
  createGalaxyClient: () => ({ listMatches: h.listMatches, getGameReviews: vi.fn() }),
}));
vi.mock("@/lib/ingest", () => ({ ingestMatch: h.ingestMatch }));
vi.mock("@/lib/errorLog", () => ({ appendSyncErrorLog: vi.fn(async () => {}) }));
vi.mock("@/lib/recompute-mistake-stats", () => ({ recomputeMistakeStats: h.recomputeMistakeStats }));
vi.mock("@/lib/recompute-repeated-positions", () => ({
  recomputeRepeatedPositions: h.recomputeRepeatedPositions,
}));

import { runSync, runDbOnlySync, MissingSelfIdentityError } from "@/lib/sync";

function analysis(matchId: number): MatchAnalysis {
  return {
    matchId,
    opponentName: "Opp",
    opponentCountry: "US",
    opponentRating: 1500,
    opponentError: 5,
    opponentScore: 1,
    userError: 4,
    userRating: 1600,
    userScore: 3,
  } as MatchAnalysis;
}

// pages[0] is page 1. Each page lists its matches.
function servePages(pages: number[][]) {
  h.listMatches.mockImplementation(async (page: number) => ({
    userId: "u1",
    userName: "me",
    totalPages: pages.length,
    analyses: pages[page - 1].map(analysis),
  }) as unknown as AnalysesListResponse);
}

function seed(sourceMatchId: number, ingestStatus: string) {
  h.state.matches.push({ id: h.state.nextId++, sourceMatchId: String(sourceMatchId), ingestStatus, ingestError: null });
}

function okSummary(matchId: number): IngestSummary {
  return {
    matchId,
    gamesIngested: 1,
    decisionsIngested: 1,
    decisionsSkippedNotCounted: 0,
    eventsSkippedNoReview: 0,
    errors: [],
    rateLimited: false,
    warnings: [],
    analysisMissing: 0,
  };
}

const statusOf = (id: number) => h.state.matches.find((m) => m.sourceMatchId === String(id))?.ingestStatus;

beforeEach(() => {
  vi.clearAllMocks();
  h.state.matches = [];
  h.state.nextId = 1;
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("runSync: Galaxy rate limit", () => {
  it("stops detail-ingest at the rate-limited match, leaves later matches untouched and records the SyncRun", async () => {
    servePages([[101, 102, 103, 104]]);
    // findMany orders by id desc, so ingest order is 104, 103, 102, 101.
    h.ingestMatch.mockImplementation(async (matchId: number) =>
      matchId === 103
        ? { ...okSummary(matchId), gamesIngested: 0, rateLimited: true, errors: ["game 1: Galaxy API returned 429 for match 103 game 1."] }
        : okSummary(matchId)
    );

    const result = await runSync({ token: "t", type: "BACKFILL" });

    expect(h.ingestMatch.mock.calls.map((c) => c[0])).toEqual([104, 103]);
    expect(statusOf(104)).toBe("DONE");
    expect(statusOf(103)).toBe("FAILED");
    expect(statusOf(102)).toBe("PENDING");
    expect(statusOf(101)).toBe("PENDING");

    expect(result.matchesProcessed).toBe(2);
    expect(result.matchesSynced).toBe(1);
    expect(result.matchesFailed).toBe(1);
    expect(result.stillPending).toBe(3);
    expect(result.rateLimitNote).toBe(
      "Galaxy rate limit: stopped after match 103; 3 matches left for the next run."
    );
    expect(result.errors.at(-1)).toEqual({ matchId: null, error: result.rateLimitNote });

    expect(h.syncRunUpdate).toHaveBeenCalledTimes(1);
    const data = (h.syncRunUpdate.mock.calls[0] as unknown as [{ data: Record<string, unknown> }])[0].data;
    expect(data.finishedAt).toBeInstanceOf(Date);
    expect(data.matchesFailed).toBe(1);
    expect(data.errors).toEqual(result.errors);

    expect(h.recomputeMistakeStats).toHaveBeenCalledTimes(1);
    expect(h.recomputeRepeatedPositions).toHaveBeenCalledTimes(1);
  });

  it("any other match failure doesn't stop the loop", async () => {
    servePages([[201, 202, 203]]);
    h.ingestMatch.mockImplementation(async (matchId: number) =>
      matchId === 202 ? { ...okSummary(matchId), errors: ["game 1: Galaxy API returned 500."] } : okSummary(matchId)
    );

    const result = await runSync({ token: "t", type: "BACKFILL" });

    expect(h.ingestMatch).toHaveBeenCalledTimes(3);
    expect(result.matchesFailed).toBe(1);
    expect(result.rateLimitNote).toBeNull();
  });

  it("a rate limit during the match-list walk ends the run with a note, not a crash", async () => {
    seed(301, "PENDING");
    h.listMatches.mockRejectedValue(new GalaxyRateLimitError("Galaxy API returned 429 for page 1."));

    const result = await runSync({ token: "t", type: "INCREMENTAL" });

    expect(h.ingestMatch).not.toHaveBeenCalled();
    expect(result.rateLimitNote).toContain("stopped during the match-list walk at page 1");
    expect(result.errors).toEqual([{ matchId: null, error: result.rateLimitNote }]);
    expect(h.syncRunUpdate).toHaveBeenCalledTimes(1);
    expect(h.recomputeMistakeStats).toHaveBeenCalledTimes(1);
  });

  it("any other match-list error still throws as before", async () => {
    h.listMatches.mockRejectedValue(new Error("Galaxy API returned 500 for page 1."));

    await expect(runSync({ token: "t", type: "INCREMENTAL" })).rejects.toThrow("500 for page 1");
  });
});

describe("runSync: match-list paging by type", () => {
  // Page 1 newest. Page 1 has one new match; page 2 is fully known; page 3
  // would hold older (known) matches.
  const PAGES = [
    [404, 405, 406],
    [401, 402, 403],
    [398, 399, 400],
  ];

  beforeEach(() => {
    for (const id of [405, 406, 401, 402, 403, 398, 399, 400]) seed(id, "DONE");
    servePages(PAGES);
    h.ingestMatch.mockImplementation(async (matchId: number) => okSummary(matchId));
  });

  it("INCREMENTAL stops after the first page whose matches are all known (still upserting it)", async () => {
    const result = await runSync({ token: "t", type: "INCREMENTAL" });

    expect(h.listMatches.mock.calls.map((c) => c[0])).toEqual([1, 2]);
    expect(result.matchesFound).toBe(6);
    expect(h.prisma.match.upsert).toHaveBeenCalledTimes(6);
    expect(h.ingestMatch.mock.calls.map((c) => c[0])).toEqual([404]);
  });

  it("BACKFILL walks every page", async () => {
    const result = await runSync({ token: "t", type: "BACKFILL" });

    expect(h.listMatches.mock.calls.map((c) => c[0])).toEqual([1, 2, 3]);
    expect(result.matchesFound).toBe(9);
  });
});

describe("runDbOnlySync: retry from the DB, no match-list walk", () => {
  const noSleep = vi.fn(async (ms: number) => void ms);

  beforeEach(() => {
    noSleep.mockClear();
    h.ingestMatch.mockImplementation(async (matchId: number) => okSummary(matchId));
  });

  it("never calls listMatches and processes only non-DONE matches, newest id first, up to the limit", async () => {
    seed(501, "FAILED");
    seed(502, "DONE");
    seed(503, "PENDING");
    seed(504, "INGESTING");
    seed(505, "FAILED");

    const result = await runDbOnlySync({ token: "t", maxMatchesToProcess: 3, sleep: noSleep, log: () => {} });

    expect(h.listMatches).not.toHaveBeenCalled();
    expect(h.prisma.playerIdentity.upsert).not.toHaveBeenCalled();
    expect(h.ingestMatch.mock.calls.map((c) => c[0])).toEqual([505, 504, 503]);
    expect(statusOf(501)).toBe("FAILED");
    expect(statusOf(502)).toBe("DONE");
    expect(result.candidates).toBe(4);
    expect(result.matchesFound).toBe(0);
    expect(result.matchesProcessed).toBe(3);
    expect(result.matchesSynced).toBe(3);
    expect(result.stillPending).toBe(1);
    expect(result.skipped).toEqual([]);
    expect(h.prisma.syncRun.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: "INCREMENTAL" }),
    });
    expect(h.syncRunUpdate).toHaveBeenCalledTimes(1);
    expect(h.recomputeMistakeStats).toHaveBeenCalledTimes(1);
    expect(h.recomputeRepeatedPositions).toHaveBeenCalledTimes(1);
  });

  it("matchIds restricts the run and reports unknown and already-DONE ids", async () => {
    seed(601, "FAILED");
    seed(602, "DONE");
    seed(603, "FAILED");

    const result = await runDbOnlySync({
      token: "t",
      matchIds: ["601", "602", "999"],
      sleep: noSleep,
      log: () => {},
    });

    expect(h.ingestMatch.mock.calls.map((c) => c[0])).toEqual([601]);
    expect(statusOf(603)).toBe("FAILED");
    expect(result.skipped).toEqual([
      { sourceMatchId: "602", reason: "already DONE" },
      { sourceMatchId: "999", reason: "not found" },
    ]);
    expect(result.candidates).toBe(1);
  });

  it("pauses between matches, not before the first, and logs one line per match", async () => {
    seed(701, "FAILED");
    seed(702, "FAILED");
    seed(703, "FAILED");
    h.ingestMatch.mockImplementation(async (matchId: number) =>
      matchId === 702 ? { ...okSummary(matchId), errors: ["game 2: Galaxy API returned 500."] } : { ...okSummary(matchId), gamesIngested: 4, decisionsIngested: 212 }
    );
    const events: string[] = [];
    noSleep.mockImplementation(async (ms: number) => void events.push(`sleep ${ms}`));

    await runDbOnlySync({
      token: "t",
      pauseBetweenMatchesMs: 5000,
      sleep: noSleep,
      log: (line) => events.push(line),
    });

    expect(noSleep).toHaveBeenCalledTimes(2);
    expect(events).toHaveLength(7);
    expect(events[0]).toMatch(/^\[1\/3\] match 703: DONE, 4 games, 212 decisions, \d+\.\ds$/);
    expect(events.slice(1, 3)).toEqual(["waiting 5s...", "sleep 5000"]);
    expect(events[3]).toMatch(/^\[2\/3\] match 702: FAILED \(game 2: Galaxy API returned 500\.\), \d+\.\ds$/);
    expect(events.slice(4, 6)).toEqual(["waiting 5s...", "sleep 5000"]);
    expect(events[6]).toMatch(/^\[3\/3\] match 701: DONE/);
  });

  it("stops cleanly on a Galaxy rate limit and still records the SyncRun and recomputes", async () => {
    seed(801, "FAILED");
    seed(802, "FAILED");
    seed(803, "FAILED");
    h.ingestMatch.mockImplementation(async (matchId: number) =>
      matchId === 802
        ? { ...okSummary(matchId), gamesIngested: 0, rateLimited: true, errors: ["game 1: Galaxy API returned 429 for match 802 game 1."] }
        : okSummary(matchId)
    );

    const result = await runDbOnlySync({ token: "t", pauseBetweenMatchesMs: 5000, sleep: noSleep, log: () => {} });

    expect(h.ingestMatch.mock.calls.map((c) => c[0])).toEqual([803, 802]);
    expect(noSleep).toHaveBeenCalledTimes(1);
    expect(statusOf(801)).toBe("FAILED");
    expect(result.rateLimitNote).toBe("Galaxy rate limit: stopped after match 802; 2 matches left for the next run.");
    expect(h.syncRunUpdate).toHaveBeenCalledTimes(1);
    expect(h.recomputeMistakeStats).toHaveBeenCalledTimes(1);
    expect(h.recomputeRepeatedPositions).toHaveBeenCalledTimes(1);
  });

  it("stops before creating a SyncRun or fetching anything when the \"you\" PlayerIdentity is missing", async () => {
    seed(901, "FAILED");
    h.prisma.playerIdentity.findFirst.mockResolvedValueOnce(null);

    await expect(runDbOnlySync({ token: "t", sleep: noSleep })).rejects.toBeInstanceOf(MissingSelfIdentityError);
    expect(h.prisma.syncRun.create).not.toHaveBeenCalled();
    expect(h.ingestMatch).not.toHaveBeenCalled();
    expect(h.listMatches).not.toHaveBeenCalled();
  });
});
