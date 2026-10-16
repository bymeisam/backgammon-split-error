import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Database URLs are read in one place, lib/databaseUrl.ts (DB_TARGET picks the
// LOCAL_* or Oracle set). Matches the old single-set names and both new sets
// by property name on any object (process.env, a parsed env file, an `env`
// parameter), by dot, by string key, or destructured.
const DB_URL_NAME = "/^(ORACLE_|LOCAL_)?DATABASE_URL/";
const DB_URL_MESSAGE =
  "Database URLs are read only in lib/databaseUrl.ts. Use dbUrl(kind), localDbUrl(kind) or targetDbUrl(target, kind) from there (DB_URL_VARS for a variable's name).";
const dbUrlRestrictions = [
  { selector: `MemberExpression[property.name=${DB_URL_NAME}]`, message: DB_URL_MESSAGE },
  { selector: `MemberExpression[computed=true][property.value=${DB_URL_NAME}]`, message: DB_URL_MESSAGE },
  { selector: `ObjectPattern > Property[key.name=${DB_URL_NAME}]`, message: DB_URL_MESSAGE },
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["**/*.{js,mjs,cjs,ts,tsx,mts,cts,jsx}"],
    rules: { "no-restricted-syntax": ["error", ...dbUrlRestrictions] },
  },
  {
    // The one reader.
    files: ["lib/databaseUrl.ts"],
    rules: { "no-restricted-syntax": "off" },
  },
  {
    // The agent guard hooks (.claude/hooks/, edited by the user only) can't
    // import TypeScript: they read the shell's database variables themselves,
    // to decide whether a command could reach a remote database.
    files: [".claude/hooks/**"],
    rules: { "no-restricted-syntax": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Galaxy's compiled web client: gitignored local reference, not our code.
    "galaxy-source/**",
    // The visual-regression suite's dedicated dev server output (see
    // playwright.config.ts, next.config.ts's distDir override) — same kind
    // of auto-generated, unlinted content as .next/** above, just under a
    // different name since both can't share one distDir.
    ".next-test/**",
    // Temporary local follow-up dev server output; generated like .next-test.
    ".next-followup/**",
  ]),
]);

export default eslintConfig;
