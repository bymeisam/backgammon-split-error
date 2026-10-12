import { isLocalAuthBypass } from "@/lib/localAuthBypass";
import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isGalaxyEnabled } from "@/lib/galaxyGate";

const galaxyPaths = [
  "/sources",
  "/galaxy",
  "/api/galaxy/",
  "/api/sync/",
  "/api/matches/check-existence",
  "/api/decisions/",
  "/api/review",
  "/api/tags",
];

function isGalaxyPath(pathname: string): boolean {
  return galaxyPaths.some((path) => pathname === path || pathname.startsWith(path.endsWith("/") ? path : `${path}/`));
}

function isPublicPath(pathname: string): boolean {
  return (
    pathname === "/sign-in" ||
    pathname.startsWith("/sign-in/") ||
    pathname === "/auth/complete"
  );
}

export default clerkMiddleware(async (auth, req) => {
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-app-route", req.nextUrl.pathname);

  if (isGalaxyPath(req.nextUrl.pathname) && !isGalaxyEnabled()) {
    return new NextResponse("Not Found", { status: 404 });
  }
  if (isPublicPath(req.nextUrl.pathname) || isLocalAuthBypass()) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }
  await auth.protect();
  return NextResponse.next({ request: { headers: requestHeaders } });
});

export const config = {
  matcher: [
    "/((?!_next|.*\\..*|__clerk).*)",
  ],
};
