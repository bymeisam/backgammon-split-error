// The local production server the script shoots against (see the header of
// index.ts): `next start` on a free port, always against the LOCAL database,
// stopped again when the run ends (also on an error or Ctrl-C).
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer } from "node:net";
import path from "node:path";
import { config as loadEnvFiles } from "dotenv";
import { DB_URL_VARS, isLocalTarget, localDbUrl } from "../../lib/databaseUrl";

const PREFERRED_PORT = 3300;
const READY_TIMEOUT_MS = 120_000;

export interface LocalServer {
  baseUrl: string;
  stop: () => Promise<void>;
}

export interface ServerOptions {
  set: string | undefined;
  readonly: boolean;
}

// 3300 when it's free, else any free port the OS hands out.
function freePort(): Promise<number> {
  const tryPort = (port: number) =>
    new Promise<number>((resolve, reject) => {
      const probe = createServer();
      probe.once("error", reject);
      probe.listen(port, () => {
        const address = probe.address();
        const chosen = typeof address === "object" && address ? address.port : port;
        probe.close(() => resolve(chosen));
      });
    });
  return tryPort(PREFERRED_PORT).catch(() => tryPort(0));
}

// The server's env: this process's env (with the env files loaded the way
// `next start` loads them, so the check below sees the URLs the server will
// use), DB_TARGET pinned to local, and each set's switches.
function serverEnv(opts: ServerOptions): NodeJS.ProcessEnv {
  // Next's production precedence, first file wins; never overrides a
  // variable already set in the shell.
  loadEnvFiles({ path: [".env.production.local", ".env.local", ".env.production", ".env"], quiet: true });
  const env: NodeJS.ProcessEnv = { ...process.env, DB_TARGET: "local" };
  env.ENABLE_WRITE_MODE = opts.readonly ? "false" : "true";
  if (opts.set === "auth") {
    // The real sign-in screens: the bypass off, whatever the env files say.
    env.AUTH_BYPASS = "false";
  } else if (opts.set === "forum") {
    // The forum's pages need a signed-in owner (lib/localAuthBypass.ts), and
    // under `next start` prismaApp needs the app URL (lib/prisma.ts); that
    // URL also turns app writes on (lib/appWriteGate.ts), so the read-only
    // run goes without it.
    env.AUTH_BYPASS = "true";
    if (!opts.readonly) {
      const appUrl = localDbUrl("app", env) ?? localDbUrl("rw", env);
      if (appUrl) env[DB_URL_VARS.local.app] = appUrl;
    }
  }
  return env;
}

function distDir(): string {
  return path.resolve(process.cwd(), process.env.NEXT_DIST_DIR || ".next");
}

async function waitUntilReady(baseUrl: string, child: ChildProcess): Promise<void> {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(`next start exited before it answered (code ${child.exitCode ?? child.signalCode})`);
    }
    try {
      await fetch(`${baseUrl}/`, { redirect: "manual" });
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw new Error(`next start didn't answer on ${baseUrl} within ${READY_TIMEOUT_MS / 1000}s`);
}

function stopChild(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
  return new Promise((resolve) => {
    const force = setTimeout(() => child.kill("SIGKILL"), 10_000);
    child.once("exit", () => {
      clearTimeout(force);
      resolve();
    });
    child.kill("SIGTERM");
  });
}

/**
 * Starts `next start` against the local DB and resolves once it answers.
 * Refuses (throws) when there's no production build, or when the LOCAL_*
 * URLs the server would use aren't all localhost.
 */
export async function startLocalServer(opts: ServerOptions): Promise<LocalServer> {
  const env = serverEnv(opts);
  if (!isLocalTarget(env)) {
    const names = Object.values(DB_URL_VARS.local).join(", ");
    throw new Error(`Refusing to start a server: ${names} must be set (the first one at least) and point at localhost.`);
  }
  if (!existsSync(path.join(distDir(), "BUILD_ID"))) {
    throw new Error(`No production build in ${path.relative(process.cwd(), distDir())}/. Run \`npm run build\` first.`);
  }

  const port = await freePort();
  const baseUrl = `http://localhost:${port}`;
  const nextBin = path.resolve(process.cwd(), "node_modules", "next", "dist", "bin", "next");
  const child = spawn(process.execPath, [nextBin, "start", "-p", String(port)], {
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  // Kept for the error message if the server never comes up.
  const output: string[] = [];
  const keep = (chunk: Buffer) => {
    output.push(chunk.toString());
    if (output.length > 50) output.shift();
  };
  child.stdout?.on("data", keep);
  child.stderr?.on("data", keep);

  // Ctrl-C or a kill: stop the server, then exit as the signal would.
  const onSignal = (signal: NodeJS.Signals) => {
    void stopChild(child).finally(() => process.exit(signal === "SIGINT" ? 130 : 143));
  };
  process.once("SIGINT", onSignal);
  process.once("SIGTERM", onSignal);
  // Last resort if the script exits some other way.
  const onExit = () => child.kill("SIGKILL");
  process.once("exit", onExit);

  const stop = async () => {
    process.off("SIGINT", onSignal);
    process.off("SIGTERM", onSignal);
    process.off("exit", onExit);
    await stopChild(child);
  };

  console.log(
    `Starting next start on port ${port} (local DB, write mode ${env.ENABLE_WRITE_MODE === "true" ? "on" : "off"}${
      env.AUTH_BYPASS === "true" ? ", AUTH_BYPASS" : ""
    })…`
  );
  try {
    await waitUntilReady(baseUrl, child);
  } catch (err) {
    await stop();
    console.error(output.join("").trim());
    throw err;
  }
  return { baseUrl, stop };
}
