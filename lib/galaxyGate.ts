// The Galaxy and sync gate, and nothing else: Galaxy's live pages and API
// (/sources, /api/galaxy/*), sync (/api/sync/*) and the Galaxy match check
// (/api/matches/check-existence), all through proxy.ts's galaxyPaths, plus the
// navbar's Sources link (app/components/ui/AppNav.tsx, lib/navItems.ts) and
// /sources itself. Everything that decides whether those are reachable reads
// this single function; nothing else re-derives the same condition. In-app
// writes (the forum, notes, tags, review) have their own gate,
// lib/appWriteGate.ts's isAppWriteEnabled(). A later rename to
// isSyncEnabled() is planned, to say what it now covers. See docs/deploy.md's
// "Lifting the Galaxy gate" section.
//
// Fails closed by construction: safe (writes disabled) is the *default*
// state with zero env vars set. ENABLE_WRITE_MODE must be the exact string
// "true" to enable anything — unset, empty, misspelled, "1", "True", or any
// other value all fall through to disabled, same as never having set it.
// DATABASE_URL being present is a second, independent requirement, not
// something ENABLE_WRITE_MODE can substitute for — the flag alone is never
// sufficient, so a stray ENABLE_WRITE_MODE=true left over in an environment
// that was never meant to have DATABASE_URL still can't turn Galaxy access
// on by itself.
export function isGalaxyEnabled(): boolean {
  return Boolean(process.env.DATABASE_URL) && process.env.ENABLE_WRITE_MODE === "true";
}
