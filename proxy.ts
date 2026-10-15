import { isLocalAuthBypass } from "@/lib/localAuthBypass";
import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isSyncEnabled } from "@/lib/galaxyGate";
import { AUTH_COMPLETE_PATH, SIGN_IN_PATH } from "@/lib/clerkConfig";

// Two jobs, in this order, for every page and API request:
//
// 1. The gate for Galaxy and sync: everything that handles a Galaxy bearer
//    token or writes Match/Game/Decision rows — see docs/deploy.md's "The
//    Galaxy gate (temporary)" section and its "Lifting the gate" subsection.
//    One choke point (the galaxyPaths list below) rather than a check
//    repeated in each handler, so there's exactly one place that can forget
//    to gate a new Galaxy-related route. isSyncEnabled() (lib/galaxyGate.ts)
//    is the single source of truth this reads — the navbar's Sources link
//    (app/components/ui/AppNav.tsx, lib/navItems.ts) reads the same function,
//    so the two can never disagree. In-app writes (the forum, decision notes,
//    tags, review: app/api/forum/*, app/api/decisions/*, app/api/tags/*,
//    app/api/review/*) aren't listed: they run on the live site too, so each
//    write handler checks isAppWriteEnabled() (lib/appWriteGate.ts) itself,
//    and their reads stay reachable.
// 2. The Clerk auth wall: every other route needs a signed-in user, except
//    the sign-in pages and /auth/complete (and everything, when the local
//    AUTH_BYPASS is on; lib/localAuthBypass.ts). Owner-only checks happen
//    later, in app/layout.tsx and the API routes (lib/app-auth.ts).
//
// `middleware.ts` is deprecated as of Next.js 16 in favor of this file
// (node_modules/next/dist/docs/.../proxy.md) — same mechanism, renamed.

// Prefixes gated by isSyncEnabled(). An entry ending in "/" matches only
// paths under it; any other entry matches itself and paths under it.
const galaxyPaths = [
  // The Sources page and Galaxy's pages under it (/sources/galaxy/matches
  // and /sources/galaxy/matches/[matchId], moved from /galaxy/matches on
  // 2026-10-09).
  "/sources",
  // The old /galaxy URLs. next.config.ts redirects them permanently to
  // /sources/galaxy/... before this runs (redirects come first), and the
  // target is gated too; kept here so they stay 404 on the read-only site
  // even if that redirect is ever removed.
  "/galaxy",
  "/api/galaxy/",
  "/api/sync/",
  "/api/matches/check-existence",
];

function isGalaxyPath(pathname: string): boolean {
  return galaxyPaths.some((path) => pathname === path || pathname.startsWith(path.endsWith("/") ? path : `${path}/`));
}

// Reachable without signing in: Clerk's sign-in pages, and the page Clerk
// returns to, which provisions the AppUser row.
function isPublicPath(pathname: string): boolean {
  return (
    pathname === SIGN_IN_PATH ||
    pathname.startsWith(`${SIGN_IN_PATH}/`) ||
    pathname === AUTH_COMPLETE_PATH
  );
}

// signInUrl: where auth.protect() sends signed-out visitors (our own page,
// not Clerk's hosted Account Portal); lib/clerkConfig.ts.
export default clerkMiddleware(
  async (auth, req) => {
    // app/layout.tsx can't see the request path, so pass it on as a header:
    // the layout uses it to skip the owner check and navbar on public pages.
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-app-route", req.nextUrl.pathname);

    if (isGalaxyPath(req.nextUrl.pathname) && !isSyncEnabled()) {
      return new NextResponse("Not Found", { status: 404 });
    }
    if (isPublicPath(req.nextUrl.pathname) || isLocalAuthBypass()) {
      return NextResponse.next({ request: { headers: requestHeaders } });
    }
    await auth.protect();
    return NextResponse.next({ request: { headers: requestHeaders } });
  },
  { signInUrl: SIGN_IN_PATH }
);

export const config = {
  matcher: [
    // Every route except Next.js internals, static files (anything with a
    // file extension) and Clerk's own /__clerk proxy paths.
    "/((?!_next|.*\\..*|__clerk).*)",
    // The dev-only snap-poc photo route (app/api/snap-poc/image/[name]): its
    // paths end in a file extension, so the line above skips them; listed
    // here so Clerk runs and the route's member check can read the session.
    "/api/snap-poc/image/:name",
  ],
};
