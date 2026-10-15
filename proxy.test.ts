// proxy.ts's Galaxy/sync gate: with isSyncEnabled() off, Galaxy and sync
// paths 404 before any handler runs, while the in-app write routes (notes,
// tags, review), which check isAppWriteEnabled() themselves, pass through.
// Clerk is mocked to a pass-through wrapper and the local auth bypass is on,
// so only the gate decides the response. The mock also records the options
// proxy.ts passes to clerkMiddleware, so the sign-in redirect target is
// checked without running real Clerk.
import { describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const clerkOptions = vi.hoisted(() => ({ value: undefined as unknown }));

vi.mock("@clerk/nextjs/server", () => ({
  clerkMiddleware: (handler: (auth: unknown, req: NextRequest) => Promise<Response>, options?: unknown) => {
    clerkOptions.value = options;
    return (req: NextRequest) => handler({ protect: async () => {} }, req);
  },
}));
vi.mock("@/lib/galaxyGate", () => ({ isSyncEnabled: () => false }));
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

describe("proxy's Clerk options", () => {
  it("sends signed-out visitors to our own /sign-in page, not Clerk's Account Portal", () => {
    expect(clerkOptions.value).toEqual({ signInUrl: "/sign-in" });
  });
});
