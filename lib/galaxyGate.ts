// Temporary stopgap — see docs/deploy.md's "Lifting the Galaxy gate" section
// for the one-place change that lifts this once the app sits behind a real
// auth wall admitting only the site owner. Everything that decides whether
// Galaxy-backed routes/links are reachable (proxy.ts, app/page.tsx) reads
// this single function; nothing else re-derives the same condition.
//
// Fails closed on purpose: DATABASE_URL absent (the expected production/
// preview state — only DATABASE_URL_READONLY is set there, see
// docs/deploy.md) or READ_ONLY_MODE missing/misspelled/anything-but-"true"
// both still leave Galaxy access decided by DATABASE_URL alone, and a
// forgotten/misconfigured READ_ONLY_MODE can only ever turn Galaxy access
// OFF, never accidentally ON.
export function isGalaxyEnabled(): boolean {
  return Boolean(process.env.DATABASE_URL) && process.env.READ_ONLY_MODE !== "true";
}
