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
};

export default nextConfig;
