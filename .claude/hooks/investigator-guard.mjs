#!/usr/bin/env node
// PreToolUse guard for the investigator subagent (.claude/agents/investigator.md).
// Second line of defence behind its tool allowlist (no Edit/Write) and the
// bg_db_ro grant: blocks Bash commands that would change files, git state,
// packages, schema or data, or expose credentials. A pattern list is not a
// sandbox — the agent's instructions are still the primary rule — but it
// catches the obvious forms. Exit 2 = block (stderr is shown to the agent).
import { readFileSync } from "node:fs";

const input = JSON.parse(readFileSync(0, "utf8"));
const command = String(input?.tool_input?.command ?? "");
// Shape checks run on the command with quoted strings emptied, so SQL like
// "WHERE x > 5" or a grep for "rm" isn't mistaken for a redirect/command.
// Credential checks run on the full text.
const unquoted = command.replace(/'[^']*'|"(?:[^"\\]|\\.)*"/g, "''");

const shapeRules = [
  [/\bgit\b(?:\s+-[cC]\s+\S+)*\s+(push|commit|add|rm|mv|reset|checkout|switch|restore|merge|rebase|cherry-pick|revert|stash|tag|branch\s+-[dDmM]|clean|apply|am|pull|fetch|init|clone|config|update-ref|gc|prune|worktree)\b/, "state-changing git command"],
  [/\b(rm|rmdir|mv|cp|mkdir|touch|tee|truncate|chmod|chown|ln|install|dd|unlink)\b/, "file-modifying command"],
  [/\bsed\b[^|]*\s-i/, "in-place edit"],
  [/(^|[^0-9&>])>>?\s*(?!\/dev\/null|&)/, "output redirection to a file"],
  [/\b(npm|pnpm|yarn|npx)\s+(i|install|add|remove|uninstall|update|ci|link|run\s+(backfill|sync|db|migrate|build|dev|start|test))\b/, "package install / write-capable npm script"],
  [/\bprisma\s+(migrate|db|generate)\b/, "prisma schema/data command"],
  [/scripts\/(backfill|incremental-sync|runSyncCli)/, "backfill/sync script"],
  [/\b(mysql|mysqldump|mysqladmin|mariadb)\b/, "direct DB client (use scripts/ro-query.ts)"],
  [/docker\s+(exec|run|compose|stop|rm|kill|restart)/, "docker command (use scripts/ro-query.ts)"],
  // Code execution only through the known read-only scripts: an ad-hoc
  // `tsx -e`/`node -e` could import the app's read-write `prisma` client.
  // The interpreter name must start a word at a command position (start,
  // whitespace, ; & | ( / or a quote/backtick) — not after a `.`, so file
  // paths like `app/x.tsx` aren't mistaken for running `tsx`. `node_modules`
  // never matches: `_` is a word char, so there's no \b after `node`.
  [/(?:^|[\s;&|(\/"'`])(tsx|ts-node|node|bun|deno|python3?|ruby|perl)\b(?!\s+scripts\/(ro-query|galaxy-get|check-oracle-cert)\.ts\b)/, "code execution outside scripts/ro-query.ts, galaxy-get.ts, check-oracle-cert.ts"],
];
const fullTextRules = [
  [/\bDATABASE_URL\b(?!_READONLY)/, "read-write DATABASE_URL"],
  [/(^|[\s'"=\/])\.env(?!\.example\b)(\.[\w-]+)?\b/, "access to .env (credentials)"],
  [/\b(printenv|env)\s*($|\||;)|\bset\s*($|\|)|\bexport\s+-p\b/, "dumping environment variables"],
  [/\bcurl\b.*\s-(X\s*(POST|PUT|PATCH|DELETE)|d|F|T)\b|--data\b/, "non-GET HTTP request"],
];

const hit =
  shapeRules.find(([pattern]) => pattern.test(unquoted)) ??
  fullTextRules.find(([pattern]) => pattern.test(command));
if (hit) {
  console.error(`Blocked for the investigator (read-only): ${hit[1]}. If this is genuinely needed, stop and report it as an open question for the main session.`);
  process.exit(2);
}
process.exit(0);
