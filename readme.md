This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Database (local Postgres + Prisma)

Local development uses a Postgres container (via Docker Compose) and Prisma as the client. This section covers infra setup only — no models exist yet.

### Prerequisites

- **Node.js** — any current LTS.
- **npm** — this project's package manager (there's a `package-lock.json`; don't add a yarn/pnpm lockfile alongside it).
- **Docker** — required to run local Postgres. Install steps genuinely differ by OS, so use the official docs rather than ad-hoc instructions:
  - **macOS / Windows**: [Docker Desktop](https://docs.docker.com/desktop/). On Windows, Docker Desktop requires [WSL2](https://learn.microsoft.com/en-us/windows/wsl/install) — the installer will prompt for this if it's missing.
  - **Linux**: [Docker Engine](https://docs.docker.com/engine/install/) via your distro's package manager, which includes the `docker compose` plugin. Docker Desktop for Linux is also an option if you prefer a GUI.

### Setup

1. Copy the example env file and fill in values (the defaults are fine for local dev):
   ```bash
   cp .env.example .env
   ```
2. Start Postgres:
   ```bash
   docker compose up -d
   ```
3. Install dependencies (this also runs `prisma generate` via a `postinstall` hook):
   ```bash
   npm install
   ```
4. Run the app and hit the smoke-test route:
   ```bash
   npm run dev
   ```
   Then open [http://localhost:3000/api/db-check](http://localhost:3000/api/db-check) (or `curl localhost:3000/api/db-check`).

**What success looks like**: `{"ok":true,"message":"Postgres connection OK"}`. This route (`app/api/db-check/route.ts`) is a throwaway smoke test for this setup step, not a feature — it's disabled outside development and can be deleted once real models/routes exist.

### If this doesn't work

- **Port 5432 already in use** — common if you also have a native Postgres install. Either stop the native instance, or remap the host port in `docker-compose.yml` (e.g. `"5433:5432"`) and update `DATABASE_URL` in `.env` to match.
- **Docker daemon not running** — `docker compose up -d` will fail with a connection error to the Docker daemon/socket. Start Docker Desktop, or on Linux, `sudo systemctl start docker`.
- **Line endings (CRLF/LF)** — no shell scripts exist in this setup yet, so this isn't an issue today; if one gets added later, make sure it's checked in with LF endings (e.g. via `.gitattributes`) so it still runs under WSL2/Git Bash on Windows.

Keep this section current: whenever a later step adds an env var, a new prerequisite, or changes a command here, update this README section rather than letting it drift.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
