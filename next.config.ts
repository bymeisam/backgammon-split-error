import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets the visual-regression suite's dedicated dev server (see
  // playwright.config.ts, e2e/README.md) run alongside the real one — a
  // second `next dev` process for the same project refuses to start
  // (a lock file inside distDir) unless it points at a different distDir
  // entirely, which port alone doesn't provide. Unset in every other
  // context (normal dev, `next build`, Vercel), so this changes nothing
  // about normal behavior.
  distDir: process.env.NEXT_DIST_DIR || ".next",

  // lib/prisma.ts's buildConnectionConfig() reads certs/oracle-mysql-ca.pem
  // off disk at runtime (fs.readFileSync(path.join(process.cwd(), "certs",
  // "oracle-mysql-ca.pem"))) — every route that touches Oracle needs it
  // physically present in its deployed function bundle, or every DB query
  // against Oracle fails. Verified this already traces correctly on its own
  // (Next's file tracer resolves that path.join(process.cwd(), ...) call
  // statically — confirmed by inspecting .next/server/app/**/*.nft.json
  // after a real build: certs/oracle-mysql-ca.pem is present in every route
  // that imports lib/prisma.ts, and absent from the client-shell pages that
  // don't). Declared explicitly anyway rather than relying solely on that
  // inference holding forever — a future refactor of buildConnectionConfig
  // that makes the path even slightly less static (a helper function, an
  // extra indirection) could silently break the heuristic with no build-time
  // error, and the failure mode is total (nothing works against Oracle
  // without this file). One small (~1.1KB) cert, applied to every route
  // rather than hand-maintaining a per-route list that drifts as routes are
  // added.
  outputFileTracingIncludes: {
    "/*": ["./certs/oracle-mysql-ca.pem"],
  },

  // Galaxy's pages moved under /sources on 2026-10-09: /galaxy/matches is
  // now /sources/galaxy/matches (and /galaxy itself /sources/galaxy). One
  // rule covers both, since :path* matches zero or more segments. Permanent
  // (308), so old links and bookmarks keep working. Redirects run before
  // proxy.ts, and every target is under /sources, which proxy.ts gates: on
  // the read-only site the redirect ends in a 404 and exposes nothing.
  async redirects() {
    return [{ source: "/galaxy/:path*", destination: "/sources/galaxy/:path*", permanent: true }];
  },

  // Only set by playwright.config.ts's webServer (the dedicated :3100 test
  // server) — hides Next's bottom-left dev-tools overlay there, since it was
  // intermittently landing inside a BoardPanel screenshot's clipped region
  // and failing the visual-regression suite's pixel-diff (see PROGRESS.md),
  // unrelated to any real content change. Unset for the normal :3000 dev
  // server, where the overlay stays on — it's a genuinely useful indicator
  // for actual local development, not something to suppress there.
  ...(process.env.DISABLE_DEV_INDICATOR ? { devIndicators: false } : {}),
};

export default nextConfig;
