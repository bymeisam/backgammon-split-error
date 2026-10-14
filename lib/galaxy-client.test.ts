// lib/galaxy-client.ts's 429 handling (lib/galaxyRateLimit.ts): retries with
// a backoff or Retry-After, then a GalaxyRateLimitError; every other status
// behaves as before. fetch is stubbed and the sleep injected, so nothing
// touches the network or really waits.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createGalaxyClient } from "@/lib/galaxy-client";
import {
  GalaxyRateLimitError,
  MAX_RATE_LIMIT_ATTEMPTS,
  MAX_RETRY_AFTER_MS,
  RATE_LIMIT_BACKOFF_MS,
  parseRetryAfter,
} from "@/lib/galaxyRateLimit";

const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>();
const sleep = vi.fn<(ms: number) => Promise<void>>(async () => {});

function status(code: number, headers: Record<string, string> = {}): Response {
  return new Response(code === 204 ? null : "x", { status: code, headers });
}

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 });
}

const LIST_BODY = { userId: "u1", userName: "me", totalPages: 1, analyses: [] };
const GAME_BODY = { data: { events: [{ id: 1 }], match_id: 5, game_index: 1 }, type: "game_events" };

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  fetchMock.mockReset();
  sleep.mockClear();
});

const client = () => createGalaxyClient("Bearer t", { sleep });

describe("429 retry", () => {
  it("listMatches: retries a 429, then returns the data", async () => {
    fetchMock.mockResolvedValueOnce(status(429)).mockResolvedValueOnce(json(LIST_BODY));

    await expect(client().listMatches(1)).resolves.toEqual(LIST_BODY);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(RATE_LIMIT_BACKOFF_MS[0]);
  });

  it("getGameReviews: retries a 429, then returns the data", async () => {
    fetchMock.mockResolvedValueOnce(status(429)).mockResolvedValueOnce(json(GAME_BODY));

    await expect(client().getGameReviews(5, 1)).resolves.toEqual(GAME_BODY);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives up after the max attempts with a GalaxyRateLimitError, backing off 5 s, 15 s, 45 s", async () => {
    fetchMock.mockImplementation(async () => status(429));

    const error = await client().getGameReviews(5, 1).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(GalaxyRateLimitError);
    expect((error as GalaxyRateLimitError).rateLimited).toBe(true);
    expect((error as Error).message).toContain("429 for match 5 game 1");
    expect(fetchMock).toHaveBeenCalledTimes(MAX_RATE_LIMIT_ATTEMPTS);
    expect(MAX_RATE_LIMIT_ATTEMPTS).toBe(4);
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([5_000, 15_000, 45_000]);
  });

  it("listMatches also gives up with a GalaxyRateLimitError", async () => {
    fetchMock.mockImplementation(async () => status(429));

    await expect(client().listMatches(3)).rejects.toBeInstanceOf(GalaxyRateLimitError);
    expect(fetchMock).toHaveBeenCalledTimes(MAX_RATE_LIMIT_ATTEMPTS);
  });
});

describe("Retry-After", () => {
  it("honours the seconds form", async () => {
    fetchMock
      .mockResolvedValueOnce(status(429, { "Retry-After": "7" }))
      .mockResolvedValueOnce(json(LIST_BODY));

    await client().listMatches(1);
    expect(sleep).toHaveBeenCalledWith(7_000);
  });

  it("honours the HTTP-date form", async () => {
    const at = new Date(Date.now() + 30_000).toUTCString();
    fetchMock
      .mockResolvedValueOnce(status(429, { "Retry-After": at }))
      .mockResolvedValueOnce(json(LIST_BODY));

    await client().listMatches(1);
    const waited = sleep.mock.calls[0][0];
    // toUTCString drops milliseconds, so up to a second short of 30 s.
    expect(waited).toBeGreaterThan(28_000);
    expect(waited).toBeLessThanOrEqual(30_000);
  });

  it("caps a long Retry-After", async () => {
    fetchMock
      .mockResolvedValueOnce(status(429, { "Retry-After": "3600" }))
      .mockResolvedValueOnce(json(LIST_BODY));

    await client().listMatches(1);
    expect(sleep).toHaveBeenCalledWith(MAX_RETRY_AFTER_MS);
  });

  it("parseRetryAfter: seconds, date, past date, cap, missing and junk", () => {
    const now = Date.parse("2026-10-14T00:00:00Z");
    expect(parseRetryAfter("10", now)).toBe(10_000);
    expect(parseRetryAfter("Wed, 14 Oct 2026 00:01:00 GMT", now)).toBe(60_000);
    expect(parseRetryAfter("Tue, 13 Oct 2026 00:00:00 GMT", now)).toBe(0);
    expect(parseRetryAfter("99999", now)).toBe(MAX_RETRY_AFTER_MS);
    expect(parseRetryAfter(null, now)).toBeNull();
    expect(parseRetryAfter("soon", now)).toBeNull();
  });
});

describe("other statuses are unchanged", () => {
  it("a 500 on listMatches throws at once, without retrying", async () => {
    fetchMock.mockResolvedValue(status(500));

    const error = await client().listMatches(2).catch((e: unknown) => e);
    expect(error).not.toBeInstanceOf(GalaxyRateLimitError);
    expect((error as Error).message).toBe("Galaxy API returned 500 for page 2.");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("a 500 on getGameReviews throws at once, without retrying", async () => {
    fetchMock.mockResolvedValue(status(500));

    await expect(client().getGameReviews(5, 2)).rejects.toThrow("Galaxy API returned 500 for match 5 game 2.");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("a 404 on getGameReviews still returns null", async () => {
    fetchMock.mockResolvedValue(status(404));

    await expect(client().getGameReviews(5, 3)).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("a network failure keeps its message", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));

    await expect(client().listMatches(1)).rejects.toThrow("Network error contacting Galaxy API.");
  });
});
