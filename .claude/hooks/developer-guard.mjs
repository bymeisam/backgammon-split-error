#!/usr/bin/env node
// PreToolUse guard for the developer subagent (.claude/agents/developer.md).
// Enforces its hard stops mechanically, behind its written instructions and
// the project-wide `git push` deny rules in .claude/settings.json:
//   - no git push in any spelling (`git -C . push` etc. slip past the
//     settings rule's prefix match; this catches them)
//   - nothing that reaches Oracle: Oracle credentials/host, the admin user,
//     and — while .env's DATABASE_URL points anywhere but localhost — any
//     command that could connect with it (prisma, scripts, seed, dev/start
//     servers, backfill/sync). The user decides when .env points where, and
//     a non-local .env never counts as approval to change Oracle.
//   - no touching .env* at all (Edit/Write or any Bash command naming it,
//     .env.example excepted) — the user makes every .env change by hand
// Exit 2 = block (stderr is shown to the agent).
import { readFileSync } from "node:fs";
import { join } from "node:path";

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
let databaseUrlIsLocal = true;
try {
  const env = readFileSync(join(projectDir, ".env"), "utf8");
  oracleHost = env.match(/^ORACLE_DB_HOST=(\S+)/m)?.[1] ?? null;
  const active = env.match(/^DATABASE_URL\s*=\s*"?([^"\n]+)"?/m)?.[1];
  if (active) databaseUrlIsLocal = /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(active);
} catch {
  // No .env: nothing can reach Oracle via it.
}

if (/\b(ORACLE_DATABASE_URL_READONLY|ORACLE_DB_HOST|awesomebg)\b|--target\s+oracle/.test(command)) block("this touches Oracle or its credentials");
if (oracleHost && command.includes(oracleHost)) block("this references the Oracle host");

const connectsToDb = /\bprisma\b|\bscripts\/|\bprisma\/seed|\bnpm\s+run\s+(dev|start|backfill|sync)|\bnext\s+(dev|start)\b/.test(command);
if (connectsToDb && !databaseUrlIsLocal) block(".env's DATABASE_URL is not localhost (likely Oracle), so this could change a remote database — even then, Oracle changes need the user's explicit approval");

process.exit(0);
