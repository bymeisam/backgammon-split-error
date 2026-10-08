// Temporary stopgap — see docs/deploy.md's "Lifting the Galaxy gate" section
// for the one-place change that lifts this once the app sits behind a real
// auth wall admitting only the site owner. Everything that decides whether
// Galaxy-backed routes/links are reachable (proxy.ts, the navbar and home
// dashboard: app/components/ui/AppNav.tsx, app/page.tsx) reads
// this single function; nothing else re-derives the same condition.
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
