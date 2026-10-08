#!/usr/bin/env node
// PreToolUse guard for the designer subagent (.claude/agents/designer.md).
// The designer proposes and never implements, so:
//   - Write/Edit: only files under <repo>/design/ or <repo>/reports/.
//     Relative paths are resolved against the project dir; any `..`
//     segment and any .env* file is rejected outright.
//   - Bash: read-only. The rules below marked "from investigator-guard.mjs"
//     are copied from .claude/hooks/investigator-guard.mjs (keep the two in
//     step when either changes). On top of those the designer may not run
//     servers, scripts, interpreters or anything that touches a database —
//     not even the investigator's read-only scripts/ro-query.ts.
// A pattern list is not a sandbox; the agent's instructions are the primary
// rule. Exit 2 = block (stderr is shown to the agent).
import { readFileSync } from "node:fs";
import { isAbsolute, resolve, sep } from "node:path";

const input = JSON.parse(readFileSync(0, "utf8"));
const tool = input?.tool_name;
const projectDir = resolve(process.env.CLAUDE_PROJECT_DIR || input?.cwd || process.cwd());

function block(reason) {
  console.error(
    `Blocked for the designer: ${reason}. The designer writes only under design/ and reports/ and runs nothing that changes state. If this is genuinely needed, stop and list it under open questions in your report.`
  );
  process.exit(2);
}

const ENV_FILE = /(^|[\\/])\.env(\.[\w.-]+)?$/;

if (tool === "Edit" || tool === "Write" || tool === "NotebookEdit" || tool === "MultiEdit") {
  const raw = String(input?.tool_input?.file_path ?? input?.tool_input?.notebook_path ?? "");
  if (raw === "") block("no file path given");
  if (raw.split(/[\\/]/).includes("..")) block("`..` in a file path");
  if (ENV_FILE.test(raw)) block(".env files are the user's alone");
  const base = isAbsolute(raw) ? raw : resolve(input?.cwd || projectDir, raw);
  const full = resolve(base);
  const allowed = [resolve(projectDir, "design"), resolve(projectDir, "reports")];
  if (!allowed.some((dir) => full.startsWith(dir + sep))) {
    block(`${raw} is outside design/ and reports/`);
  }
  process.exit(0);
}

if (tool !== "Bash") process.exit(0);
const command = String(input?.tool_input?.command ?? "");
// Shape checks run on the command with quoted strings emptied, so a grep for
// "rm" or "> 5" isn't mistaken for a command or redirect. Credential checks
// run on the full text.
const unquoted = command.replace(/'[^']*'|"(?:[^"\\]|\\.)*"/g, "''");

const shapeRules = [
  // --- from investigator-guard.mjs ---
  [/\bgit\b(?:\s+-[cC]\s+\S+)*\s+(push|commit|add|rm|mv|reset|checkout|switch|restore|merge|rebase|cherry-pick|revert|stash|tag|branch\s+-[dDmM]|clean|apply|am|pull|fetch|init|clone|config|update-ref|gc|prune|worktree)\b/, "state-changing git command"],
  [/\b(rm|rmdir|mv|cp|mkdir|touch|tee|truncate|chmod|chown|ln|install|dd|unlink)\b/, "file-modifying command (use the Write tool, under design/ or reports/)"],
  [/\bsed\b[^|]*\s-i/, "in-place edit"],
  [/(^|[^0-9&>])>>?\s*(?!\/dev\/null|&)/, "output redirection to a file (use the Write tool, under design/ or reports/)"],
  [/\bprisma\s+(migrate|db|generate)\b/, "prisma schema/data command"],
  [/\b(mysql|mysqldump|mysqladmin|mariadb)\b/, "direct DB client"],
  [/docker\s+(exec|run|compose|stop|rm|kill|restart)/, "docker command"],
  // --- designer-only additions ---
  // Package managers and runners: installs, npm scripts (dev/start/build/
  // test/backfill/sync), npx anything (tsx, playwright, prisma, next).
  [/(?:^|[\s;&|(`])(npm|npx|pnpm|pnpx|yarn|bunx?|corepack)\b/, "package manager / script runner"],
  // Interpreters at a command position (as in investigator-guard.mjs, but
  // with no read-only-script exception). `app/x.tsx` and `node_modules`
  // don't match: a `.` or `_` never precedes/follows at a word boundary.
  [/(?:^|[\s;&|(\/"'`])(tsx|ts-node|node|bun|deno|python3?|ruby|perl|php)\b/, "running code or a script"],
  // Tools at a command position, so reading `prisma/schema.prisma`,
  // `playwright.config.ts` or `docker-compose.yml` with cat/grep is fine.
  [/(?:^|[;&|(`]\s*)(prisma|docker|docker-compose|next|playwright|mysql\w*)(?![\w.\/-])/, "running prisma, docker, next, playwright or a DB client"],
  [/\bnext\s+(dev|start|build)\b/, "Next.js server or build"],
  // A script as the command itself (`./scripts/x.ts`, `scripts/x`), or a
  // shell told to run one. Reading scripts/ with cat/grep is fine.
  [/(?:^|[;&|(`]\s*)(\.\/)?scripts\/|\bcd\s+(\.\/)?scripts\b/, "running something under scripts/"],
  [/(?:^|[\s;&|(`])(sh|bash|zsh|source|exec|eval)\s/, "running a shell, script or eval"],
  [/\b(nohup|disown|launchctl|brew|kill|pkill|killall)\b/, "process or system management"],
];
const fullTextRules = [
  // --- from investigator-guard.mjs ---
  [/\bDATABASE_URL/, "database connection string"],
  [/(^|[\s'"=\/<])\.env(?!\.example\b)(\.[\w-]+)?\b/, "access to .env (credentials)"],
  [/\b(printenv|env)\s*($|\||;)|\bset\s*($|\|)|\bexport\s+-p\b/, "dumping environment variables"],
  [/\bcurl\b.*\s-(X\s*(POST|PUT|PATCH|DELETE)|d|F|T|o|O)\b|--data\b|--output\b|--remote-name\b/, "non-GET HTTP request or download to a file"],
  // --- designer-only additions ---
  [/\b(curl|wget|http|xh)\b.*(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)/, "a request to the local app or database"],
  [/\bwget\b/, "wget (downloads to a file)"],
  [/\b(GALAXY_TOKEN|ORACLE_DB_HOST|bg_db_rw|bg_db_ro|awesomebg)\b/, "credentials or database names"],
];

const hit =
  shapeRules.find(([pattern]) => pattern.test(unquoted)) ??
  fullTextRules.find(([pattern]) => pattern.test(command));
if (hit) block(hit[1]);
process.exit(0);
