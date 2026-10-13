#!/usr/bin/env node
// SessionStart hook (wired in .claude/settings.json): tells the main session
// when omp has finished work that master hasn't checked yet.
// Reads omp's copy of the queue (`git show omp/main:docs/omp-queue.md`) and
// lists the entries under "Done by omp (to check)" (or the old name, "Ready
// for review"), skipping any entry that names a commit already listed under
// master's "Checked and done (master)". Entries that name no commit are
// always shown. Read-only: it only runs `git show`, and never touches omp's
// worktree. Prints nothing when there is nothing new; stdout goes into the
// session's context. Always exits 0, so a missing branch never blocks a session.
import { execFileSync } from "node:child_process";

const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();

function show(ref) {
  try {
    return execFileSync("git", ["show", `${ref}:docs/omp-queue.md`], {
      cwd: projectDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return null;
  }
}

// The body of the first "## " section whose heading matches, up to the next "## ".
function section(text, headingPattern) {
  const lines = text.split("\n");
  const start = lines.findIndex((l) => l.startsWith("## ") && headingPattern.test(l));
  if (start === -1) return "";
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => l.startsWith("## "));
  return (end === -1 ? rest : rest.slice(0, end)).join("\n");
}

// Abbreviated to 7 characters, so `7224f45` and a longer form of it match.
function commits(text) {
  return [...text.matchAll(/`([0-9a-f]{7,40})`/g)].map((m) => m[1].slice(0, 7));
}

const omp = show("omp/main");
const master = show("master");
if (!omp || !master) process.exit(0);

const checked = new Set(commits(section(master, /^## Checked and done|^## Done\s*$/)));
const toCheck = section(omp, /Done by omp \(to check\)|Ready for review/);

const entries = toCheck
  .split(/\n(?=### )/)
  .filter((e) => e.startsWith("### "))
  .map((e) => ({ title: e.split("\n")[0].slice(4).trim(), commits: commits(e) }))
  .filter((e) => !e.commits.some((c) => checked.has(c)));

if (entries.length === 0) process.exit(0);

const out = ["omp queue: omp marked these done and master hasn't checked them yet:"];
for (const e of entries) {
  const where = e.commits.length ? `commits ${e.commits.join(", ")}` : "no commit named";
  out.push(`- ${e.title} (${where})`);
}
out.push(
  "Tell the user at the start of your first reply and offer to review (docs/omp-queue.md has the flow).",
);
console.log(out.join("\n"));
