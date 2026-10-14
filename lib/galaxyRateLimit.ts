// Galaxy rate-limit handling, shared by both lib/galaxy-client.ts requests
// (listMatches, getGameReviews). Galaxy answers 429 once a client has sent
// too many requests in a short window. Before 2026-10-14 a 429 was treated
// like any other error: sync's back-to-back requests used up the limit and
// then every remaining match failed within seconds (73 failures in
// logs/sync-errors.log, the same 36 matches in two runs). Now a 429 is
// retried with a backoff, and only once the retries run out does the caller
// get a GalaxyRateLimitError, which lib/sync.ts uses to stop the run cleanly
// instead of failing every remaining match.
//
// Kept in its own module (not lib/galaxy-client.ts) so lib/ingest.ts and
// lib/sync.ts can check `instanceof GalaxyRateLimitError` even in tests that
// mock the whole Galaxy client.

// Galaxy's backoff when a 429 carries no Retry-After header: wait 5 s, then
// 15 s, then 45 s. Three waits between four attempts in total.
export const RATE_LIMIT_BACKOFF_MS = [5_000, 15_000, 45_000] as const;
export const MAX_RATE_LIMIT_ATTEMPTS = RATE_LIMIT_BACKOFF_MS.length + 1;

// Upper bound on a Retry-After wait, so a header asking for an hour can't
// stall a sync run for that long.
export const MAX_RETRY_AFTER_MS = 120_000;

export type Sleep = (ms: number) => Promise<void>;

export const sleep: Sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Thrown once a request has been rate-limited on every attempt. Distinct
// from every other Galaxy failure, which keep throwing a plain Error.
export class GalaxyRateLimitError extends Error {
  readonly rateLimited = true;

  constructor(message: string) {
    super(message);
    this.name = "GalaxyRateLimitError";
  }
}

// Retry-After is either a number of seconds or an HTTP date. Returns the
// wait in ms, capped at MAX_RETRY_AFTER_MS (a date in the past is 0), or
// null when the header is missing or unreadable (the caller then uses its
// own backoff).
export function parseRetryAfter(header: string | null, now: number = Date.now()): number | null {
  if (header === null) return null;
  const value = header.trim();
  if (value === "") return null;

  let ms: number;
  if (/^\d+$/.test(value)) {
    ms = Number(value) * 1000;
  } else {
    const date = Date.parse(value);
    if (Number.isNaN(date)) return null;
    ms = Math.max(0, date - now);
  }
  return Math.min(ms, MAX_RETRY_AFTER_MS);
}

// fetch, retried on 429. Every other response (ok or not) is returned on
// the first attempt, unchanged, so callers keep their own status handling.
// A network failure throws the same message the client always used.
// `describe` names the request in the final rate-limit error ("page 3",
// "match 123 game 1").
export async function fetchWithRateLimitRetry(
  url: string,
  init: RequestInit,
  describe: string,
  sleepFn: Sleep = sleep
): Promise<Response> {
  for (let attempt = 1; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, init);
    } catch {
      throw new Error("Network error contacting Galaxy API.");
    }

    if (res.status !== 429) return res;

    if (attempt >= MAX_RATE_LIMIT_ATTEMPTS) {
      throw new GalaxyRateLimitError(
        `Galaxy API returned 429 for ${describe} (rate limited; gave up after ${attempt} attempts).`
      );
    }

    const waitMs =
      parseRetryAfter(res.headers.get("retry-after")) ?? RATE_LIMIT_BACKOFF_MS[attempt - 1];
    console.warn(
      `Galaxy API returned 429 for ${describe}; retrying in ${Math.round(waitMs / 1000)} s (attempt ${attempt + 1} of ${MAX_RATE_LIMIT_ATTEMPTS}).`
    );
    await sleepFn(waitMs);
  }
}
