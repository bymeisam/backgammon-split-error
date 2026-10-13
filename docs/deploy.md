# Deploying to Vercel

This app deploys to Vercel as a viewer of data already synced into Oracle
HeatWave. The only writes on Vercel are in-app ones (the forum, decision
notes, tags, review cards and logs, and AppUser provisioning), all through
the narrow `bg_db_app` credential. Nothing on Vercel writes Match/Game/
Decision rows or talks to Galaxy — syncing stays a local-only operation (see
"Syncing stays local" below). This doc covers what env vars to set, why the cert/region settings
exist, how to lift the temporary Galaxy gate later, and the manual steps
only you can do (env vars, Oracle firewall, verifying the deploy).

## Required environment variables (production + preview)

Set these on Vercel (Project Settings → Environment Variables), for both the
Production and Preview environments:

| Variable                | Value |
| ----------------------- | ----- |
| `DATABASE_URL_READONLY` | `mysql://bg_db_ro:<password>@<oracle-host>:3306/backgammon?ssl=true&allowPublicKeyRetrieval=true` |
| `DATABASE_URL_APP`      | `mysql://bg_db_app:<password>@<oracle-host>:3306/backgammon?ssl=true&allowPublicKeyRetrieval=true` — every in-app write: the forum, decision notes, tags, review, AppUser provisioning (grants in `scripts/sql/app-db-user.sql`) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk's publishable key |
| `CLERK_SECRET_KEY`      | Clerk's server-only secret key |

The Clerk sign-in and after-auth paths are set in code (`lib/clerkConfig.ts`), so Vercel needs only the two Clerk keys.

**Never set `DATABASE_URL` on Vercel**, and **don't set `ENABLE_WRITE_MODE`
on Vercel either — leave it unset.** The admin client (`prisma`, `bg_db_rw`)
remains unconfigured, and the Galaxy/sync gate remains closed. Both stay
local only, for sync, Galaxy and migrations. `DATABASE_URL_APP` is the one
write credential on Vercel: `bg_db_app`, with SELECT on the schema and
writes only on the forum, study (notes, tags, review) and `AppUser` tables —
never on Match/Game/Decision, and no DDL. It must not be the
ingest/migration credential.

Three clients, three credentials (`lib/prisma.ts`):

- `prisma` (the admin client, used by ingest, sync and Galaxy code) is lazy
  and throws if used without `DATABASE_URL`, which Vercel never has.
- `prismaReadOnly` uses `DATABASE_URL_READONLY` (`bg_db_ro`) for every read.
- `prismaApp` uses `DATABASE_URL_APP` in production (it never falls back to
  `DATABASE_URL` there; locally it does, through `appDatabaseUrl()`) and is
  limited by the `bg_db_app` grants. AppUser provisioning at sign-in uses it
  whenever it has a URL; every other in-app write is also gated by
  `isAppWriteEnabled()` (see "The two write gates" below).

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

## The two write gates

Two separate switches, each failing closed:

- **Galaxy and sync**: `isGalaxyEnabled()` (`lib/galaxyGate.ts`), below. Needs
  `DATABASE_URL` and `ENABLE_WRITE_MODE=true`, so it's local only. A rename to
  `isSyncEnabled()` is planned.
- **App writes**: `isAppWriteEnabled()` (`lib/appWriteGate.ts`), for the
  forum, decision notes, tags and review (cards, answers, bulk add). On when
  `DATABASE_URL_APP` is set (Vercel), or, outside production, when
  `isGalaxyEnabled()` is (local write mode, where `prismaApp` falls back to
  `DATABASE_URL`). Each write route checks it itself and returns 403 when it's
  off; the pages hide their write controls the same way. AppUser provisioning
  doesn't check it, so sign-in works wherever `prismaApp` has a URL.

## The Galaxy gate (temporary)

Everything that handles a Galaxy bearer token or syncs Match/Game/Decision
rows is gated behind `isGalaxyEnabled()` (`lib/galaxyGate.ts`):

```ts
export function isGalaxyEnabled(): boolean {
  return Boolean(process.env.DATABASE_URL) && process.env.ENABLE_WRITE_MODE === "true";
}
```

It fails closed by construction — disabled is the *default* with zero env
vars set, and enabling it requires two independent things to both be true:
`DATABASE_URL` present, and `ENABLE_WRITE_MODE` set to exactly `"true"`.
Either one being absent/wrong (a forgotten `ENABLE_WRITE_MODE`, or a stray
`DATABASE_URL` in an environment that was never meant to have one) is
enough to keep Galaxy access off — the flag alone is never sufficient.

In-app writes (the forum, notes, tags, review) are not behind this gate:
they use `isAppWriteEnabled()` and `DATABASE_URL_APP` (see "The two write
gates" above), so the live site can accept them while Galaxy and sync stay
off there.

This is the single source of truth for Galaxy and sync, read in these places:

- **`proxy.ts`** (project root) — the one choke point. Its `matcher` covers
  `/sources` and `/sources/:path*` (the Sources page and Galaxy's pages
  under it, `/sources/galaxy/matches[/…]`, since 2026-10-09), the old
  `/galaxy` and `/galaxy/:path*` (which `next.config.ts` first redirects
  permanently to `/sources/galaxy/…`, itself gated), `/api/galaxy/:path*`,
  `/api/sync/:path*`, and `/api/matches/check-existence`; when the gate is
  closed, every one of those returns a plain 404 before the route's own
  code ever runs. (This Next.js version renamed `middleware.ts` to
  `proxy.ts` — same mechanism.)
- **The navbar and `/sources`** — `app/components/ui/AppNav.tsx` (through
  `lib/navItems.ts`) hides the Sources link when the gate is closed, so
  there's no dead link to a 404, and `app/sources/page.tsx` 404s itself too.

`/matches`, `/matches/[matchId]`, `/mistakes`, `/repeated-positions`,
`/matches/analysis`, and their own read-only `/api/matches/*` routes are
**not** gated — they only ever read via `prismaReadOnly`/`DATABASE_URL_READONLY`
and stay available regardless of the flag.

### Lifting the gate

Once the app sits behind a real auth wall that admits only you, lifting the
gate is a **pure environment-variable change on Vercel — no code edit
required**, because the call sites above already read `isGalaxyEnabled()`
as their only source of truth (in-app writes don't depend on this; they're
already on through `DATABASE_URL_APP`):

1. Set `DATABASE_URL` on Vercel again (a real read-write credential).
2. Set `ENABLE_WRITE_MODE=true` on Vercel too — with the new default-off
   polarity, both are required; setting `DATABASE_URL` alone still leaves
   the gate shut.

`isGalaxyEnabled()` starts returning `true` on the next request after that
env change takes effect, and `proxy.ts`, the navbar and `/sources` pick it
up automatically.

## Manual steps (only you can do these)

1. **Link the repo** to a new Vercel project (`vercel link`, or via the
   Vercel dashboard's "Import Project").
2. **Set the env vars** above (`DATABASE_URL_READONLY`, `DATABASE_URL_APP`
   and the Clerk keys) for both Production and Preview — leave
   `DATABASE_URL` and `ENABLE_WRITE_MODE` unset on both. Create `bg_db_app`
   first, with the owner's approval (`scripts/sql/app-db-user.sql`).
3. **Decide the Oracle port-3306 ingress.** Oracle HeatWave's firewall is
   currently scoped to your home IP only. Vercel Hobby functions don't have
   a fixed, allowlist-able outbound IP range (static outbound IPs / Secure
   Compute are Pro/Enterprise features) — so as deployed today, Vercel's
   functions **cannot reach Oracle at all** until this is opened up. Real
   options, in order of how much they widen exposure:
   - Open port 3306 to `0.0.0.0/0` on the HeatWave DB System's ingress rule,
     relying on TLS (the pinned CA) plus the scoped `bg_db_ro` credential
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

## App authentication, owner and members

The app uses Clerk's invite-only sign-in flow (`/sign-in`). Do not add a
public `SignUpButton`; disable public sign-up in the Clerk dashboard and invite
only approved people. Every first signed-in access provisions an `AppUser`
row with `role=NONE` (awaiting approval) and the Clerk display name. The role
is set by hand (`lib/appRole.ts` resolves it):

- **Owner**: `AppUser.role` is `OWNER` **and** the verified Clerk user's
  `privateMetadata.isOwner` is `true`. DB `OWNER` without the Clerk flag
  counts as a member; the Clerk flag on its own grants nothing.
- **Member**: `AppUser.role` is `MEMBER`. Read-only matches, analysis,
  replays, mistakes, repeated positions and settings, plus the forum. No
  notes, tags, review data, `/review`, `/sources` or `/status`.
- **NONE**: signed in, awaiting approval.

Which pages and APIs each role reaches is one table, `lib/accessRules.ts`
(anything unlisted is owner-only). Identity matching uses the verified Clerk
user ID, never email or client metadata. Unauthenticated document requests go
to `/sign-in`; NONE goes to `/auth/complete`, which provisions the local row if
needed and shows the pending-approval state without exposing application
data; a member on an owner page gets a 404. APIs return 401 for signed-out
requests and 404 for a role that isn't allowed.

The authenticated `/position-builder` route is a member page. It keeps edits in memory and can link to `/forum/new` with canonical GNU IDs; it does not create a database row until the forum post transaction. Forum mutations, like the owner's notes, tags and review, use the app write gate, `isAppWriteEnabled()` (`lib/appWriteGate.ts`), and the app credential, `DATABASE_URL_APP` (`prismaApp`), so they work on the hosted deployment; locally, without `DATABASE_URL_APP`, they follow `ENABLE_WRITE_MODE` as before.

`ENABLE_WRITE_MODE` remains the Galaxy/sync gate. Clerk ownership does not turn hosted Galaxy or sync on: hosted deployments should continue to leave `DATABASE_URL` and `ENABLE_WRITE_MODE` unset. `DATABASE_URL_APP` (`bg_db_app`) covers the `AppUser` allowlist and every in-app write, and has no write access to Match, Game or Decision.

### Clerk domain (read this if sign-in breaks after a domain change)

- **Today the production instance uses the `*.vercel.app` URL.** On 2026-10-13 Clerk accepted the Vercel URL as the production application domain and showed its domains as verified, even though [Clerk's Vercel guide](https://clerk.com/docs/guides/development/deployment/vercel) says production needs a domain you own. If sign-in on the live site breaks, suspect this first. The fallback is Clerk's **development** instance (`pk_test_` / `sk_test_` keys), which works on `*.vercel.app`, or moving to the planned domain below.
- **Planned domain:** `backgammon.bymeisam.dev` (decided 2026-10-13). When the app moves there:
  1. Add the domain to the Vercel project (Settings → Domains) and set its DNS.
  2. In Clerk, create the production instance (clone the development one), enter `backgammon.bymeisam.dev` as the application domain, and add the DNS records Clerk lists (CNAMEs such as `clerk.` and `accounts.` under the domain). Wait until Clerk shows them verified and the SSL certificates issued.
  3. In Vercel, set the production keys (`pk_live_` / `sk_live_`) on **Production**; keep the development keys on **Preview** if previews still need sign-in.
  4. Users don't carry over between Clerk instances: re-invite members in the production instance, and set the owner's `privateMetadata.isOwner = true` there again. Their `AppUser` rows are keyed by Clerk user id (`clerkUserId`), so the new instance's ids create new rows (role `NONE`): set the owner's new row to `OWNER` and members' to `MEMBER`, and delete or leave the old rows.
  5. Check the redirect/allowed-origin settings in Clerk name the new domain, then run "Auth verification" below.
- **Known snags:** SSL issuance in Clerk can stall on CAA DNS records (Clerk support fixed it by hand for others); the Vercel Marketplace Clerk integration has been reported to fall back to development keys ("Production domain required"). Contact Clerk support for either.

### Temporary local development auth bypass

Setting `AUTH_BYPASS=true` temporarily bypasses the Clerk document and API
owner checks through `lib/localAuthBypass.ts` so the local forum and
position-builder flows can be smoke-tested without a Clerk browser session. The
bypass acts as the reserved `local-dev-owner` `AppUser` (the owner), or with
`AUTH_BYPASS_ROLE=member` as a separate `local-dev-member` (an invited member),
for the role checks and when a write needs an author. It is an explicit opt-in (off unless exactly `true`), refuses to turn
on and logs a warning when `DATABASE_URL`, `DATABASE_URL_READONLY` or
`DATABASE_URL_APP` points anywhere but
localhost, and does not disable `isGalaxyEnabled()`, `isAppWriteEnabled()`
or their database/write-mode gates. Never set it on a deployed
environment. Remove this
bypass after local authenticated smoke and visual review are complete.

## Auth verification (do this after every deploy)

Open the production URL in a private/incognito window. It must redirect to `/sign-in`. A signed-in user with `AppUser.role` NONE must land on `/auth/complete` and receive no application data; a member must get a 404 on `/review` and `/status`. Verify the owner's Clerk private metadata and `AppUser.role` (OWNER) separately after migrations.

## Making the Claude PR review actually block merges (manual, GitHub settings)

**Authentication**: both `claude-review.yml` and `claude.yml` authenticate
via workload identity federation, not a repository secret — there's no
`ANTHROPIC_API_KEY` (or any other secret) to add. The GitHub Actions
federation issuer and this repo's rule are already registered in the
Claude Console (Settings → Workload identity). The three values committed
in each workflow (`anthropic_federation_rule_id`, `anthropic_organization_id`,
`anthropic_service_account_id`) are identifiers, not credentials — safe to
commit as plain YAML values, visible in a public diff, exactly as they
appear in the workflow files.

`.github/workflows/claude-review.yml` runs an automated review on every
pull request and fails its job when it finds a `high`-severity finding at
more than low confidence (see that file's own comments for the exact
parsing logic). **A failing job by itself does not block a merge** — GitHub
only prevents merging on a failing check when that check is explicitly
marked *required* in the repository's branch protection settings, and that
can't be set from a workflow file; it's a one-time manual step:

1. GitHub → this repo → **Settings → Branches**.
2. Add (or edit) a branch protection rule for `master`.
3. Enable **"Require status checks to pass before merging"**.
4. In the status-check search box, add **`review`** — the job name from
   `claude-review.yml` (GitHub only offers a job as a searchable status
   check after it's run at least once, so open one real PR first if the
   job doesn't appear in the list yet).
5. Save.

Without this step, `claude-review.yml` still runs and still posts its
review comments and inline findings on every PR — the review itself is
fully functional either way — but a `high`-severity finding only shows as
a red ✗ next to the PR's checks, not as an actual merge block, until this
setting is turned on.

`claude.yml` (the `@claude`-mention on-demand re-review) is **not** meant to
be added as a required check here — it doesn't run automatically on every
PR (only when someone mentions `@claude`), so requiring it would block
every PR that never gets mentioned. Only `claude-review.yml`'s `review` job
should be marked required.
