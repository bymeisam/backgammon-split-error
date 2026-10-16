// Who may open each page and call each API: the one access table.
//
//   public: no sign-in needed (Clerk's sign-in pages, and /auth/complete,
//           which provisions the AppUser row).
//   member: invited members and the owner (lib/appRole.ts) — the read-only
//           study views and the forum.
//   owner:  the owner only — review, sources, status, notes, tags, sync and
//           every write that isn't the forum's.
//
// Anything not listed is owner (fail closed), so a new page or API stays
// owner-only until it's added here on purpose.
//
// Readers: every page (app/**/page.tsx calls requireMemberDocument or
// requireOwnerDocument at the top of its server component; a client page
// gets a server wrapper), app/layout.tsx as a second layer (from the
// x-app-route header proxy.ts sets; layouts don't re-render on client-side
// navigation, so the layout alone isn't enough) and each API route, which
// calls the helper for its tier (lib/app-auth.ts). lib/accessRules.test.ts
// globs every app/**/page.tsx and app/api/**/route.ts and fails when a
// page's or route's helper and this table disagree.
//
// Patterns are path segments: `*` matches exactly one segment, a trailing
// `**` matches zero or more. The first matching rule wins.

export type AccessTier = "public" | "member" | "owner";

type Rule = { pattern: string; tier: AccessTier };

export const ACCESS_RULES: readonly Rule[] = [
  // Public.
  { pattern: "/sign-in/**", tier: "public" },
  { pattern: "/auth/complete", tier: "public" },

  // Member pages.
  { pattern: "/", tier: "member" },
  { pattern: "/matches/**", tier: "member" },
  { pattern: "/mistakes", tier: "member" },
  { pattern: "/repeated-positions", tier: "member" },
  { pattern: "/forum/**", tier: "member" },
  { pattern: "/position-builder", tier: "member" },
  { pattern: "/settings", tier: "member" },
  // Dev-only (404 in production): the Snaps proof-of-concept review page.
  { pattern: "/snap-poc", tier: "member" },

  // Member APIs. Everything else under /api (decision notes, decisions,
  // review, tags, sync, galaxy, check-existence, db-check) is owner.
  { pattern: "/api/engine/analyze", tier: "member" },
  { pattern: "/api/forum/**", tier: "member" },
  { pattern: "/api/matches/list/**", tier: "member" },
  { pattern: "/api/matches/*/*", tier: "member" },
  { pattern: "/api/player-identities", tier: "member" },
  // Dev-only (404 in production): app/snap-poc's photo and truth-file routes.
  { pattern: "/api/snap-poc/**", tier: "member" },
];

function segments(path: string): string[] {
  return path.split("/").filter(Boolean);
}

function matches(pattern: string, path: string): boolean {
  const want = segments(pattern);
  const have = segments(path);
  for (let i = 0; i < want.length; i++) {
    if (want[i] === "**" && i === want.length - 1) return true;
    if (i >= have.length) return false;
    if (want[i] !== "*" && want[i] !== have[i]) return false;
  }
  return want.length === have.length;
}

/** The tier for a request path (no query string). Unlisted paths are owner. */
export function accessTierFor(pathname: string): AccessTier {
  for (const rule of ACCESS_RULES) {
    if (matches(rule.pattern, pathname)) return rule.tier;
  }
  return "owner";
}
