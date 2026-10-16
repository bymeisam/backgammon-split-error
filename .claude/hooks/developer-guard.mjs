#!/usr/bin/env node
// PreToolUse guard for the developer subagent (.claude/agents/developer.md).
// Enforces its hard stops mechanically, behind its written instructions and
// the project-wide `git push` deny rules in .claude/settings.json:
//   - no git push in any spelling (`git -C . push` etc. slip past the
//     settings rule's prefix match; this catches them)
//   - nothing that reaches Oracle: Oracle credentials/host, DB_TARGET=oracle
//     or the ORACLE_DATABASE_URL* vars anywhere in a command, the admin
//     user, and any command that could connect to a database (prisma,
//     scripts/, seed, tsx/ts-node/node/bun/deno, dev/start servers,
//     backfill/sync, Playwright/e2e, curl/wget to localhost) unless DB_TARGET
//     is local (unset or empty counts) and every LOCAL_DATABASE_URL* is
//     localhost, in every .env* file (.env.example excepted) and in the
//     shell. It fails closed: an unreadable env file, an unlistable project
//     dir or no LOCAL_DATABASE_URL at all counts as "not local". The logic
//     lives in developer-guard-lib.mjs (tested). The user decides when .env
//     targets what, and DB_TARGET=oracle never counts as approval to change
//     Oracle. Pattern-based, not a sandbox.
//   - no touching .env* at all (Edit/Write or any Bash command naming it,
//     .env.example excepted) — the user makes every .env change by hand
// Never prints a URL or any env value. Exit 2 = block (stderr is shown to the agent).
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { connectsToDb, databaseIsLocal, GUARD_ENV_VARS, namesOracle } from "./developer-guard-lib.mjs";

const input = JSON.parse(readFileSync(0, "utf8"));
const tool = input?.tool_name;
const projectDir = process.env.CLAUDE_PROJECT_DIR || input?.cwd || process.cwd();

function block(reason) {
  console.error(`Blocked for the developer: ${reason}. Prepare the steps and stop — report them to the main session for the user's approval.`);
  process.exit(2);
}

if (tool === "Edit" || tool === "Write" || tool === "NotebookEdit") {
  const path = String(input?.tool_input?.file_path ?? input?.tool_input?.notebook_path ?? "");
  if (/(^|\/)\.env(\.(?!example$)[\w-]+)?$/.test(path)) block(".env files are the user's to change — tell the user exactly what to change instead");
  process.exit(0);
}

if (tool !== "Bash") process.exit(0);
const command = String(input?.tool_input?.command ?? "");

// Quoted text is stripped first (so a commit message mentioning .env is
// fine), but a quoted string that *is* a .env path still counts.
const unquoted = command.replace(/'[^']*'|"(?:[^"\\]|\\.)*"/g, "''");
const envPath = /(^|[\s=\/<>])\.env(?!\.example\b)(\.[\w-]+)?\b/;
const quotedEnvPath = /["'](\.\/|[^"'\s]*\/)?\.env(?!\.example\b)(\.[\w-]+)?["']/;
if (envPath.test(unquoted) || quotedEnvPath.test(command)) block(".env files are the user's to change and read — tell the user what's needed instead");
if (/\bgit\b[^|;&]*\bpush\b/.test(unquoted)) block("git push is never done by agents — the user pushes after review");

let oracleHost = null;
try {
  const env = readFileSync(join(projectDir, ".env"), "utf8");
  oracleHost = env.match(/^ORACLE_DB_HOST=(\S+)/m)?.[1] ?? null;
} catch {
  // No .env: no Oracle host to look for (the DB check below fails closed on its own).
}

if (namesOracle(command)) block("this touches Oracle or its credentials (DB_TARGET=oracle and the Oracle URLs are the user's alone)");
if (oracleHost && command.includes(oracleHost)) block("this references the Oracle host");

// Every .env* file Next.js, Playwright or dotenv could load, plus the shell's
// DB_TARGET and LOCAL_DATABASE_URL*. Unreadable or undiscoverable means "not local".
function currentDatabase() {
  let names;
  try {
    names = readdirSync(projectDir).filter((n) => /^\.env(\..+)?$/.test(n) && n !== ".env.example");
  } catch {
    return { local: false, reason: "could not list the project directory to find .env files" };
  }
  const files = names.map((name) => {
    try {
      return { name, text: readFileSync(join(projectDir, name), "utf8") };
    } catch {
      return { name, text: null };
    }
  });
  const shell = Object.fromEntries(GUARD_ENV_VARS.map((name) => [name, process.env[name]]));
  return databaseIsLocal({ shell, files });
}

if (connectsToDb(command)) {
  const { local, reason } = currentDatabase();
  if (!local) block(`the database isn't confirmed local (${reason}), so this could change a remote database (likely Oracle) — even then, Oracle changes need the user's explicit approval`);
}

process.exit(0);
