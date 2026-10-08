import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadPlayerIdentities, resetPlayerIdentitiesCache } from "./usePlayerIdentities";

const ROWS = [
  { id: 1, source: "galaxy", sourceUserId: "me", displayName: "Me", isMe: true },
  { id: 2, source: "galaxy", sourceUserId: "opp", displayName: "Opp", isMe: false },
];

function okResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}

describe("loadPlayerIdentities", () => {
  beforeEach(() => {
    resetPlayerIdentitiesCache();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("makes one request for two concurrent callers, and both get the rows", async () => {
    const fetchMock = vi.fn(async () => okResponse(ROWS));
    vi.stubGlobal("fetch", fetchMock);

    const [a, b] = await Promise.all([loadPlayerIdentities(), loadPlayerIdentities()]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/player-identities");
    expect(a).toEqual(ROWS);
    expect(b).toEqual(ROWS);
  });

  it("reuses the result for a caller that comes later", async () => {
    const fetchMock = vi.fn(async () => okResponse(ROWS));
    vi.stubGlobal("fetch", fetchMock);

    await loadPlayerIdentities();
    expect(await loadPlayerIdentities()).toEqual(ROWS);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("doesn't keep a network failure: the next call retries", async () => {
    const fetchMock = vi
      .fn<() => Promise<Response>>()
      .mockRejectedValueOnce(new TypeError("network down"))
      .mockResolvedValueOnce(okResponse(ROWS));
    vi.stubGlobal("fetch", fetchMock);

    await expect(loadPlayerIdentities()).rejects.toThrow("network down");
    expect(await loadPlayerIdentities()).toEqual(ROWS);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("doesn't keep an HTTP error either", async () => {
    const fetchMock = vi
      .fn<() => Promise<Response>>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: "db" }), { status: 500 }))
      .mockResolvedValueOnce(okResponse(ROWS));
    vi.stubGlobal("fetch", fetchMock);

    await expect(loadPlayerIdentities()).rejects.toThrow("HTTP 500");
    expect(await loadPlayerIdentities()).toEqual(ROWS);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
