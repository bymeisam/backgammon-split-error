// Pure helpers for developer-guard.mjs: no I/O, no process access, so they
// can be unit-tested with in-memory strings (developer-guard-lib.test.mjs).
// Everything here fails closed: when in doubt, "not local" and "connects".

// The database variables lib/databaseUrl.ts reads. DB_TARGET picks the set
// ("local" when unset or empty); only the LOCAL_* URLs are checked here,
// because any target other than local already means "not local".
export const DB_TARGET_VAR = "DB_TARGET";
export const LOCAL_URL_VARS = ["LOCAL_DATABASE_URL", "LOCAL_DATABASE_URL_READONLY", "LOCAL_DATABASE_URL_APP"];
// Every name developer-guard.mjs reads from the shell.
export const GUARD_ENV_VARS = [DB_TARGET_VAR, ...LOCAL_URL_VARS];

// Every value of `name` in one env file's text, in file order. Duplicates
// are all returned (dotenv uses the last one; the caller checks them all).
export function parseEnvValues(text, name) {
  const line = new RegExp(`^\\s*(?:export\\s+)?${name}\\s*=\\s*(.*)$`);
  const values = [];
  for (const raw of String(text ?? "").split(/\r?\n/)) {
    if (/^\s*#/.test(raw)) continue;
    const m = raw.match(line);
    if (!m) continue;
    const rest = m[1].trim();
    const quoted = rest.match(/^(["'])(.*?)\1/);
    // Unquoted values end at an inline `#` comment, as in dotenv.
    values.push(quoted ? quoted[2] : rest.replace(/\s*#.*$/, "").trim());
  }
  return values;
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export function isLocalUrl(url) {
  if (typeof url !== "string" || url === "") return false;
  try {
    return LOCAL_HOSTS.has(new URL(url).hostname.toLowerCase());
  } catch {
    return false;
  }
}

// Every value of `name` that could reach a process: the shell's, then each
// file's. dotenv and Next never override a variable already set in the
// shell, so the shell value stands in for .env's own (and counts even when
// .env doesn't exist). The other .env* files are all checked (Playwright
// reads .env.test, Next reads .env.local etc.).
function candidates(name, shell, files) {
  const out = []; // { source, value }
  const shellSet = typeof shell?.[name] === "string";
  if (shellSet) out.push({ source: "shell", value: shell[name] });
  for (const f of files ?? []) {
    if (f.name === ".env" && shellSet) continue;
    for (const value of parseEnvValues(f.text, name)) out.push({ source: f.name, value });
  }
  return out;
}

// shell: { DB_TARGET, LOCAL_DATABASE_URL, LOCAL_DATABASE_URL_READONLY,
//          LOCAL_DATABASE_URL_APP } from process.env (string | undefined each).
// files: [{ name, text }] for every .env* file (except .env.example);
// text === null means the file exists but couldn't be read.
// Local means: no DB_TARGET anywhere other than "local" or empty, at least
// one non-empty LOCAL_DATABASE_URL, and every non-empty LOCAL_* URL on
// localhost. Returns { local, reason }. `reason` names sources and
// variables, never values.
export function databaseIsLocal({ shell, files }) {
  const unreadable = (files ?? []).filter((f) => f.text === null).map((f) => f.name);
  if (unreadable.length) return { local: false, reason: `could not read ${unreadable.join(", ")}` };

  const badTarget = candidates(DB_TARGET_VAR, shell, files).filter((c) => c.value !== "" && c.value !== "local");
  if (badTarget.length) {
    return { local: false, reason: `DB_TARGET is not local in: ${[...new Set(badTarget.map((c) => c.source))].join(", ")}` };
  }

  const rw = candidates(LOCAL_URL_VARS[0], shell, files).filter((c) => c.value !== "");
  if (rw.length === 0) return { local: false, reason: "no LOCAL_DATABASE_URL found" };

  const failing = [];
  for (const name of LOCAL_URL_VARS) {
    for (const c of candidates(name, shell, files)) {
      if (c.value !== "" && !isLocalUrl(c.value)) failing.push(`${name} (${c.source})`);
    }
  }
  if (failing.length) return { local: false, reason: `not localhost: ${[...new Set(failing)].join(", ")}` };
  return { local: true, reason: "DB_TARGET is local and every LOCAL_* URL is localhost" };
}

// Commands that name Oracle: its host secret, ro-query's oracle target, the
// target flag set to oracle, or the Oracle URL variables. Blocked outright,
// whatever the env says.
const ORACLE_COMMAND = /\b(ORACLE_DB_HOST|awesomebg)\b|--target\s+oracle|\bDB_TARGET\s*=\s*["']?oracle\b|ORACLE_DATABASE_URL/i;

export function namesOracle(command) {
  return ORACLE_COMMAND.test(String(command ?? ""));
}

const DB_COMMAND_PATTERNS = [
  /\bprisma\b/,
  /\bscripts\//,
  /\bprisma\/seed/,
  /\bnpm\s+run\s+(dev|start|backfill|sync|db|screenshots)/,
  /\bnext\s+(dev|start)\b/,
  /\bnpm\s+start\b/,
  // Interpreter at a command position (start, whitespace, ; & | ( / or a
  // quote/backtick), never after a `.`, so `app/x.tsx` isn't "running tsx".
  // `node_modules` doesn't match: `_` is a word char, so no \b after `node`.
  /(?:^|[\s;&|(\/"'`])(tsx|ts-node|node|bun|deno)\b/,
  /\bcd\s+(\.\/)?scripts\b/,
  /\bplaywright\b/,
  /test:visual/,
  /\be2e\//,
];
const HTTP_CLIENT = /\b(curl|wget|http|xh)\b/;
const LOCAL_HOST_TEXT = /localhost|127\.0\.0\.1|\[::1\]/;

// True if the command could connect to a database. Matched against the full
// command text, quotes included. Pattern-based, not a sandbox.
export function connectsToDb(command) {
  const cmd = String(command ?? "");
  if (DB_COMMAND_PATTERNS.some((re) => re.test(cmd))) return true;
  return HTTP_CLIENT.test(cmd) && LOCAL_HOST_TEXT.test(cmd);
}
