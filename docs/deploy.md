# Deploying to Vercel

This app deploys to Vercel as a **read-only viewer** of data already synced
into Oracle HeatWave. Nothing on Vercel writes to the database or talks to
Galaxy — syncing stays a local-only operation (see "Syncing stays local"
below). This doc covers what env vars to set, why the cert/region settings
exist, how to lift the temporary Galaxy gate later, and the manual steps
only you can do (env vars, Oracle firewall, verifying the deploy).

## Required environment variables (production + preview)

Set **only** these two on Vercel (Project Settings → Environment Variables),
for both the Production and Preview environments:

| Variable                | Value                                            |
| ------------------------ | ------------------------------------------------ |
| `DATABASE_URL_READONLY`  | `mysql://bg_readonly:<password>@<oracle-host>:3306/backgammon?ssl=true&allowPublicKeyRetrieval=true` |
| `READ_ONLY_MODE`         | `true`                                            |

**Never set `DATABASE_URL` on Vercel.** Its absence is what makes this a
read-only deployment in the first place:

- `lib/prisma.ts`'s write client (`prisma`, used by ingest/sync code) is
  lazy — importing the module never throws, but the moment anything tries to
  actually *use* that client without `DATABASE_URL` set, it throws loudly.
  Since nothing on Vercel is supposed to call it, this should never fire in
  normal operation; if it ever does, that's a real bug to investigate, not
  something to paper over with a dummy `DATABASE_URL`.
- `isGalaxyEnabled()` (`lib/galaxyGate.ts`) requires `DATABASE_URL` to be
  present as its *first* condition — so leaving it unset is also what keeps
  the Galaxy gate closed (see "Lifting the Galaxy gate" below).

`GALAXY_TOKEN` is never read by the deployed app either (only by the local
sync scripts) — don't set it on Vercel.

## The CA cert

`certs/oracle-mysql-ca.pem` pins Oracle HeatWave's private CA so the
`mariadb` driver can do real TLS verification against it (see the comment in
`lib/prisma.ts`). It's read off disk at runtime
(`fs.readFileSync(path.join(process.cwd(), "certs", "oracle-mysql-ca.pem"))`),
which means it has to physically end up inside whatever Vercel actually
bundles for each serverless function — nothing works against Oracle without
it.

Verified this already traces correctly on its own: Next's file tracer
(`@vercel/nft`, the same mechanism Vercel's build uses to decide what ships
in each function) resolves that `path.join(process.cwd(), ...)` call
statically. Inspecting `.next/server/app/**/*.nft.json` after a real build
confirms `certs/oracle-mysql-ca.pem` is listed in every route that imports
`lib/prisma.ts`, and absent from routes that don't need it.

Declared it explicitly anyway, in `next.config.ts`'s
`outputFileTracingIncludes`, rather than relying solely on that inference
holding forever — a future refactor of `buildConnectionConfig` that makes
the path even slightly less static could silently break the heuristic with
no build-time error, and the failure mode is total (nothing works against
Oracle without this file). Applied broadly (`"/*"`, every route) rather than
a hand-maintained per-route list, since it's one small (~1.1KB) file and a
narrow list would silently stop covering a new route added later.

## Region

`vercel.json` pins the function region to `syd1` (Sydney) — Oracle HeatWave
is in Melbourne, and earlier slowness investigating `/mistakes` etc. was WAN
latency between the default `iad1` (Washington, D.C.) region and Melbourne,
not a query-plan problem. Confirmed valid on the Hobby plan: Hobby supports
exactly one function region (Pro supports up to 5), and `syd1` is a real,
currently-supported region code — verified against Vercel's own docs
(`vercel.com/docs/functions/configuring-functions/region`) before adding
this, not assumed.

## Syncing stays local

`scripts/backfill.ts` and `scripts/incremental-sync.ts` are the only way
new matches get into Oracle for now — run them from your own machine
against `DATABASE_URL` (the read-write Oracle credential) and a fresh
`GALAXY_TOKEN`, same as always. The deployed app never does this itself: see
"The Galaxy gate" below for what that means concretely.

## The Galaxy gate (temporary)

Everything that writes to the DB or handles a Galaxy bearer token is gated
behind `isGalaxyEnabled()` (`lib/galaxyGate.ts`):

```ts
export function isGalaxyEnabled(): boolean {
  return Boolean(process.env.DATABASE_URL) && process.env.READ_ONLY_MODE !== "true";
}
```

It fails closed — either `DATABASE_URL` being absent (the normal production
state above) or `READ_ONLY_MODE` being `"true"` is enough to disable Galaxy
access; a forgotten/misconfigured flag can never accidentally turn it *on*.

This is the single source of truth, read in exactly two places:

- **`proxy.ts`** (project root) — the one choke point. Its `matcher` covers
  `/galaxy/matches`, `/galaxy/matches/:path*`, `/api/galaxy/:path*`,
  `/api/sync/:path*`, and `/api/matches/check-existence`; when the gate is
  closed, every one of those returns a plain 404 before the route's own
  code ever runs. (This Next.js version renamed `middleware.ts` to
  `proxy.ts` — same mechanism.)
- **`app/page.tsx`** — hides the "Fetch live from Galaxy" home-page link
  when the gate is closed, so there's no dead link to a 404.

`/matches`, `/matches/[matchId]`, `/mistakes`, `/repeated-positions`,
`/matches/analysis`, and their own read-only `/api/matches/*` routes are
**not** gated — they only ever read via `prismaReadOnly`/`DATABASE_URL_READONLY`
and stay available regardless of the flag.

### Lifting the gate

Once the app sits behind a real auth wall that admits only you, lifting the
gate is a **pure environment-variable change on Vercel — no code edit
required**, because both call sites above already read `isGalaxyEnabled()`
as their only source of truth:

1. Set `DATABASE_URL` on Vercel again (a real read-write credential).
2. Remove the `READ_ONLY_MODE` env var (or set it to anything other than
   `"true"`).

`isGalaxyEnabled()` starts returning `true` on the next request after that
env change takes effect, and `proxy.ts`/`app/page.tsx` both pick it up
automatically. If you also want to remove the gate mechanism from the code
entirely at that point (optional cleanup, not required to lift it): delete
`proxy.ts`, `lib/galaxyGate.ts`, and the `isGalaxyEnabled()` conditional
around the Galaxy link in `app/page.tsx`.

## Manual steps (only you can do these)

1. **Link the repo** to a new Vercel project (`vercel link`, or via the
   Vercel dashboard's "Import Project").
2. **Set the env vars** above (`DATABASE_URL_READONLY`, `READ_ONLY_MODE=true`)
   for both Production and Preview.
3. **Decide the Oracle port-3306 ingress.** Oracle HeatWave's firewall is
   currently scoped to your home IP only. Vercel Hobby functions don't have
   a fixed, allowlist-able outbound IP range (static outbound IPs / Secure
   Compute are Pro/Enterprise features) — so as deployed today, Vercel's
   functions **cannot reach Oracle at all** until this is opened up. Real
   options, in order of how much they widen exposure:
   - Open port 3306 to `0.0.0.0/0` on the HeatWave DB System's ingress rule,
     relying on TLS (the pinned CA) plus the scoped `bg_readonly` credential
     for security — the common trade-off for serverless-to-managed-DB
     connections without a fixed egress IP.
   - Upgrade to Vercel Pro and use Secure Compute for a static outbound IP,
     then allowlist just that IP on Oracle's side.
   This is a real security decision with cost/exposure trade-offs either
   way — deliberately not made for you here, and out of scope for this task
   anyway ("don't touch Oracle... settings").
4. **Deploy a preview first**, not production directly.
5. **Check `/status` on that preview URL** — it should show the live Oracle
   row counts (4,288 matches as of the last check in PROGRESS.md; expect
   this to have grown if you've synced since). If `/status` shows a
   connection error instead, step 3 is almost certainly the cause.

## Auth verification (do this after every deploy)

**Vercel does not put a login screen in front of your app by default.**
After deploying, open the production URL in a private/incognito window —
one with no Vercel account session at all. If the site loads, it is
genuinely public: anyone with the URL can read your synced match data (not
write — the Galaxy gate above prevents that regardless), and you should not
rely on "nobody has the link" as your actual security boundary.

If that's not acceptable, you need one of:

- **Vercel Deployment/Production Protection** (Project Settings → Deployment
  Protection) — gates the whole app behind a Vercel login, at the platform
  level, no app code involved.
- **An app-level gate** — e.g. a `proxy.ts` check (the same mechanism this
  doc's Galaxy gate uses) requiring a shared secret or session cookie before
  serving anything.

Neither is set up as part of this task (Vercel-settings changes were
explicitly out of scope) — this is flagged for you to decide and configure.
