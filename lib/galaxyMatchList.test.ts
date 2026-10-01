import { describe, expect, it } from "vitest";
import type { MatchAnalysis } from "@/lib/analysesTypes";
import {
  interpretSyncResponse,
  resolveSyncState,
  sortNewestFirst,
  type SyncState,
} from "@/lib/galaxyMatchList";

const match = (matchId: number) => ({ matchId }) as MatchAnalysis;

describe("sortNewestFirst", () => {
  it("orders by matchId descending", () => {
    expect(sortNewestFirst([match(3), match(10), match(7)]).map((m) => m.matchId)).toEqual([10, 7, 3]);
  });

  it("doesn't mutate the input", () => {
    const input = [match(1), match(2)];
    sortNewestFirst(input);
    expect(input.map((m) => m.matchId)).toEqual([1, 2]);
  });

  it("handles empty and single-item lists", () => {
    expect(sortNewestFirst([])).toEqual([]);
    expect(sortNewestFirst([match(5)]).map((m) => m.matchId)).toEqual([5]);
  });
});

describe("interpretSyncResponse", () => {
  it("treats ingested games as synced", () => {
    expect(interpretSyncResponse({ gamesIngested: 3, errors: [] })).toEqual({ status: "synced" });
  });

  it("treats some games ingested despite errors as synced (partial success)", () => {
    expect(interpretSyncResponse({ gamesIngested: 2, errors: ["game 3 failed"] })).toEqual({ status: "synced" });
  });

  it("treats nothing ingested *with* errors as a failure, surfacing the first error", () => {
    expect(interpretSyncResponse({ gamesIngested: 0, errors: ["bad token", "other"] })).toEqual({
      status: "error",
      message: "bad token",
    });
  });

  it("treats nothing ingested with no errors as synced (an empty match isn't a failure)", () => {
    expect(interpretSyncResponse({ gamesIngested: 0, errors: [] })).toEqual({ status: "synced" });
    expect(interpretSyncResponse({ gamesIngested: 0 })).toEqual({ status: "synced" });
  });

  it("doesn't throw on odd bodies", () => {
    expect(interpretSyncResponse(null)).toEqual({ status: "synced" });
    expect(interpretSyncResponse({ gamesIngested: 0, errors: "not an array" })).toEqual({ status: "synced" });
  });
});

describe("resolveSyncState", () => {
  const done = new Set(["200", "300"]);

  it("prefers this session's own state over the DB check", () => {
    const states: Record<number, SyncState> = { 200: { status: "error", message: "x" } };
    expect(resolveSyncState(states, done, 200)).toEqual({ status: "error", message: "x" });
  });

  it("shows a match the DB already has as synced", () => {
    expect(resolveSyncState({}, done, 300)).toEqual({ status: "synced" });
  });

  it("has no state for an unknown, unsynced match", () => {
    expect(resolveSyncState({}, done, 400)).toBeUndefined();
  });

  it("passes through in-progress syncs", () => {
    expect(resolveSyncState({ 400: { status: "syncing" } }, done, 400)).toEqual({ status: "syncing" });
  });

  it("matches DB ids as strings (sourceMatchId is a string column)", () => {
    expect(resolveSyncState({}, new Set(["123"]), 123)).toEqual({ status: "synced" });
    expect(resolveSyncState({}, new Set([]), 123)).toBeUndefined();
  });
});
