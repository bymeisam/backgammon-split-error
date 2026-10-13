// proxy.ts's Galaxy/sync gate: with isGalaxyEnabled() off, Galaxy and sync
// paths 404 before any handler runs, while the in-app write routes (notes,
// tags, review), which check isAppWriteEnabled() themselves, pass through.
// Clerk is mocked to a pass-through wrapper and the local auth bypass is on,
// so only the gate decides the response.
import { describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

vi.mock("@clerk/nextjs/server", () => ({
  clerkMiddleware: (handler: (auth: unknown, req: NextRequest) => Promise<Response>) => (req: NextRequest) =>
    handler({ protect: async () => {} }, req),
}));
vi.mock("@/lib/galaxyGate", () => ({ isGalaxyEnabled: () => false }));
vi.mock("@/lib/localAuthBypass", () => ({ isLocalAuthBypass: () => true }));

import proxy from "./proxy";

type Proxy = (req: NextRequest) => Promise<Response>;

function request(pathname: string): NextRequest {
  return { nextUrl: { pathname }, headers: new Headers() } as unknown as NextRequest;
}

async function status(pathname: string): Promise<number> {
  return (await (proxy as unknown as Proxy)(request(pathname))).status;
}

describe("proxy with the Galaxy gate off", () => {
  it.each(["/api/review/cards", "/api/tags/attach", "/api/decisions/1/note", "/api/review/queue", "/api/tags"])(
    "lets the in-app route %s through",
    async (pathname) => {
      expect(await status(pathname)).not.toBe(404);
    }
  );

  it.each(["/api/sync/incremental", "/api/galaxy/x", "/sources", "/sources/galaxy/matches", "/galaxy/matches", "/api/matches/check-existence"])(
    "404s the Galaxy/sync route %s",
    async (pathname) => {
      expect(await status(pathname)).toBe(404);
    }
  );
});
