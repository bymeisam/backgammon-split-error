// Pure helpers for developer-guard.mjs: no I/O, no process access, so they
// can be unit-tested with in-memory strings (developer-guard-lib.test.mjs).
// Everything here fails closed: when in doubt, "not local" and "connects".

const DATABASE_URL_LINE = /^\s*(?:export\s+)?DATABASE_URL\s*=\s*(.*)$/;

// Every DATABASE_URL value in one env file's text, in file order. Duplicates
// are all returned (dotenv uses the last one; the caller checks them all).
export function parseDatabaseUrls(text) {
  const values = [];
  for (const line of String(text ?? "").split(/\r?\n/)) {
    if (/^\s*#/.test(line)) continue;
    const m = line.match(DATABASE_URL_LINE);
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

// shellValue: process.env.DATABASE_URL (string | undefined).
// files: [{ name, text }] for every .env* file (except .env.example);
// text === null means the file exists but couldn't be read.
// Returns { local, reason }. `reason` names sources, never URL values.
export function databaseIsLocal({ shellValue, files }) {
  const unreadable = (files ?? []).filter((f) => f.text === null).map((f) => f.name);
  if (unreadable.length) return { local: false, reason: `could not read ${unreadable.join(", ")}` };

  const candidates = []; // { source, url }
  const shellSet = typeof shellValue === "string";
  // dotenv never overrides a variable already set in the shell, so the shell
  // value stands in for .env's own (and counts even when .env doesn't exist).
  if (shellSet) candidates.push({ source: "shell", url: shellValue });
  for (const f of files ?? []) {
    if (f.name === ".env" && shellSet) continue;
    for (const url of parseDatabaseUrls(f.text)) candidates.push({ source: f.name, url });
  }

  if (candidates.length === 0) return { local: false, reason: "no DATABASE_URL found" };

  const failing = [...new Set(candidates.filter((c) => !isLocalUrl(c.url)).map((c) => c.source))];
  if (failing.length) return { local: false, reason: `DATABASE_URL is not localhost in: ${failing.join(", ")}` };
  return { local: true, reason: "every DATABASE_URL is localhost" };
}

const DB_COMMAND_PATTERNS = [
  /\bprisma\b/,
  /\bscripts\//,
  /\bprisma\/seed/,
  /\bnpm\s+run\s+(dev|start|backfill|sync)/,
  /\bnext\s+(dev|start)\b/,
  /\bnpm\s+start\b/,
  /\b(tsx|ts-node|node|bun|deno)\b/, // `node_modules` doesn't match: `_` is a word char
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
