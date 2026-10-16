import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Keeps the Oracle database URLs in one file. lib/databaseUrl.ts is the only
// code that may name ORACLE_DATABASE_URL (or its _READONLY/_APP variants);
// everything else asks it for a URL (dbUrl, localDbUrl, targetDbUrl) or uses
// its DB_URL_VARS constants for a variable's name. The ESLint rule in
// eslint.config.mjs covers process.env reads; this covers every other
// mention, in any tracked or new (not ignored) file.
//
// A real exception goes in ALLOWED below, with its reason. Keep it tight.

const ROOT = path.resolve(__dirname, "..");
const NEEDLE = "ORACLE_DATABASE_URL";

const ALLOWED: ReadonlyArray<{ match: (file: string) => boolean; why: string }> = [
  { match: (f) => f === "lib/databaseUrl.ts", why: "the one reader" },
  { match: (f) => f === "lib/databaseUrlGuard.test.ts", why: "this test names what it looks for" },
  { match: (f) => f === ".env.example", why: "documents the variables for the user" },
  { match: (f) => f.startsWith("docs/"), why: "docs describe the variables (deploy checklist, field mapping, history)" },
  { match: (f) => f === "PROGRESS.md", why: "history log" },
  { match: (f) => f === "e2e/README.md", why: "documents the test-database setup" },
  { match: (f) => f.startsWith("agents/roles/"), why: "agent role sources tell agents never to use the Oracle URLs" },
  // Generated from agents/roles/ by `npm run agents:sync`.
  { match: (f) => f.startsWith(".claude/agents/") || f.startsWith(".omp/agents/"), why: "generated agent files" },
  // The guard hooks block commands that name the Oracle URLs, so they have to
  // name them too (they can't import TypeScript).
  { match: (f) => f.startsWith(".claude/hooks/"), why: "guard hooks block commands naming the Oracle URLs" },
];

function candidateFiles(): string[] {
  // Tracked files plus new, not-ignored ones, so a file is checked before
  // it's committed too.
  const out = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  return [...new Set(out.split("\0").filter(Boolean))].sort();
}

describe("Oracle database URL names stay in lib/databaseUrl.ts", () => {
  it("no other file names them", () => {
    const offenders: string[] = [];
    for (const file of candidateFiles()) {
      if (ALLOWED.some((a) => a.match(file))) continue;
      let content: Buffer;
      try {
        content = readFileSync(path.join(ROOT, file));
      } catch {
        continue; // deleted in the working tree but still in the index
      }
      if (content.includes(NEEDLE)) offenders.push(file);
    }
    expect(offenders, `Read database URLs through lib/databaseUrl.ts, not by name. Found in: ${offenders.join(", ")}`).toEqual([]);
  });
});
