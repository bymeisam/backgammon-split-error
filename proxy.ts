import { NextResponse } from "next/server";
import { isGalaxyEnabled } from "@/lib/galaxyGate";

// Temporary stopgap gate for everything that writes to the DB or handles a
// Galaxy bearer token — see docs/deploy.md's "Lifting the Galaxy gate"
// section. One choke point (this file's matcher) rather than a check
// repeated in each handler, so there's exactly one place that can forget to
// gate a new Galaxy-related route. isGalaxyEnabled() (lib/galaxyGate.ts) is
// the single source of truth this reads — the navbar's link-hiding
// (app/components/ui/AppNav.tsx) reads
// the same function, so the two can never disagree.
//
// `middleware.ts` is deprecated as of Next.js 16 in favor of this file
// (node_modules/next/dist/docs/.../proxy.md) — same mechanism, renamed.
// Declares only the `request` param it actually uses — none, in this case
// (see node_modules/next/dist/docs/.../proxy.md: "Declare only the ones you
// use").
export function proxy() {
  if (isGalaxyEnabled()) {
    return NextResponse.next();
  }
  return new NextResponse("Not Found", { status: 404 });
}

export const config = {
  matcher: [
    // The Sources page and Galaxy's pages under it (/sources/galaxy/matches
    // and /sources/galaxy/matches/[matchId], moved from /galaxy/matches on
    // 2026-10-09).
    "/sources",
    "/sources/:path*",
    // The old /galaxy URLs. next.config.ts redirects them permanently to
    // /sources/galaxy/... before this runs (redirects come first), and the
    // target is gated above; kept here too so they stay 404 on the
    // read-only site even if that redirect is ever removed.
    "/galaxy",
    "/galaxy/:path*",
    "/api/galaxy/:path*",
    "/api/sync/:path*",
    "/api/matches/check-existence",
    // Decision-note writes (POST /api/decisions/[id]/note) — the app's
    // first write path outside sync/ingest, gated the same way.
    "/api/decisions/:path*",
    // Spaced-repetition review and tags (app/api/review/*, app/api/tags/*):
    // card create/answer/suspend/delete, bulk add, tag attach/detach, and
    // the queue/summary/tag-list reads only the write-mode UI uses.
    "/api/review",
    "/api/review/:path*",
    "/api/tags",
    "/api/tags/:path*",
  ],
};
