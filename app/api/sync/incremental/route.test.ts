// The capped Vercel sync route calls runSync exactly as before the CLI
// pacing (2026-10-14): no pauses, no log lines, no dry run. lib/sync and the
// auth check are mocked; no DB or network.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const h = vi.hoisted(() => ({ runSync: vi.fn(), requireOwnerApi: vi.fn(async () => null) }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/sync", () => ({ runSync: h.runSync }));
vi.mock("@/lib/app-auth", () => ({ requireOwnerApi: h.requireOwnerApi }));

import { POST } from "@/app/api/sync/incremental/route";

function request(body: unknown): NextRequest {
  return new Request("http://localhost/api/sync/incremental", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

describe("POST /api/sync/incremental", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls runSync with only the token, INCREMENTAL and the 20-match cap", async () => {
    h.runSync.mockResolvedValue({ matchesProcessed: 2, stillPending: 0, rateLimitNote: null });

    const res = await POST(request({ authorization: " tok " }));

    expect(res.status).toBe(200);
    expect(h.runSync).toHaveBeenCalledTimes(1);
    expect(h.runSync.mock.calls[0]).toEqual([{ token: "tok", type: "INCREMENTAL", maxMatchesToProcess: 20 }]);
  });
});
