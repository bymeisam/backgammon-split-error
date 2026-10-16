// Run: node --test .claude/hooks/developer-guard-lib.test.mjs
// In-memory strings only — no env files are created on disk.
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseEnvValues, isLocalUrl, databaseIsLocal, connectsToDb, namesOracle } from "./developer-guard-lib.mjs";

const LOCAL = "mysql://app:pw@localhost:3306/app_dev";
const REMOTE = "mysql://bg_db_rw:pw@203.0.113.7:3306/backgammon?ssl=true";
const RW = "LOCAL_DATABASE_URL";

test("parseEnvValues: plain", () => {
  assert.deepEqual(parseEnvValues(`${RW}=${LOCAL}`, RW), [LOCAL]);
});

test("parseEnvValues: export and whitespace around =", () => {
  assert.deepEqual(parseEnvValues(`export ${RW} = ${REMOTE}`, RW), [REMOTE]);
});

test("parseEnvValues: double and single quotes", () => {
  assert.deepEqual(parseEnvValues(`${RW}="${LOCAL}"\n${RW}='${REMOTE}'`, RW), [LOCAL, REMOTE]);
});

test("parseEnvValues: commented lines ignored", () => {
  assert.deepEqual(parseEnvValues(`# ${RW}=${REMOTE}\n  #${RW}=${REMOTE}\n${RW}=${LOCAL}`, RW), [LOCAL]);
});

test("parseEnvValues: duplicate key returns both, in order", () => {
  assert.deepEqual(parseEnvValues(`${RW}=${LOCAL}\nOTHER=1\n${RW}=${REMOTE}`, RW), [LOCAL, REMOTE]);
});

test("parseEnvValues: other keys sharing a prefix or suffix are ignored", () => {
  assert.deepEqual(parseEnvValues(`${RW}_READONLY=${REMOTE}\n${RW}_FOO=${REMOTE}\nX_${RW}=${REMOTE}\nDATABASE_URL=${REMOTE}`, RW), []);
});

test("parseEnvValues: DB_TARGET, quoted or inline-commented", () => {
  assert.deepEqual(parseEnvValues(`DB_TARGET=oracle # careful\nDB_TARGET="local"`, "DB_TARGET"), ["oracle", "local"]);
});

test("isLocalUrl", () => {
  assert.equal(isLocalUrl("mysql://u:p@localhost:3306/db"), true);
  assert.equal(isLocalUrl("mysql://u:p@127.0.0.1:3306/db"), true);
  assert.equal(isLocalUrl("mysql://u:p@[::1]:3306/db"), true);
  assert.equal(isLocalUrl(REMOTE), false);
  assert.equal(isLocalUrl("mysql://u:p@localhost.evil.com/db"), false);
  assert.equal(isLocalUrl("not a url"), false);
  assert.equal(isLocalUrl(""), false);
  assert.equal(isLocalUrl(undefined), false);
});

// One env file with both URL sets, as in the user's .env.
const envFile = (name, { target, rw = LOCAL, ro = LOCAL, app = "" } = {}) => ({
  name,
  text: [
    "FOO=bar",
    target === undefined ? "" : `DB_TARGET=${target}`,
    `${RW}="${rw}"`,
    `${RW}_READONLY="${ro}"`,
    `${RW}_APP="${app}"`,
    `ORACLE_DATABASE_URL="${REMOTE}"`,
    `ORACLE_DATABASE_URL_READONLY="${REMOTE}"`,
    "",
  ].join("\n"),
});
const NO_SHELL = {};

test("databaseIsLocal: local target, all local", () => {
  for (const target of [undefined, "", "local"]) {
    const r = databaseIsLocal({ shell: NO_SHELL, files: [envFile(".env", { target }), envFile(".env.test", { rw: "mysql://u:p@127.0.0.1/bg_test" })] });
    assert.equal(r.local, true, String(target));
  }
});

test("databaseIsLocal: the Oracle URLs alone don't make it remote (only DB_TARGET does)", () => {
  assert.equal(databaseIsLocal({ shell: NO_SHELL, files: [envFile(".env", { target: "local" })] }).local, true);
});

test("databaseIsLocal: DB_TARGET=oracle in .env", () => {
  const r = databaseIsLocal({ shell: NO_SHELL, files: [envFile(".env", { target: "oracle" })] });
  assert.equal(r.local, false);
  assert.match(r.reason, /DB_TARGET.*\.env/);
});

test("databaseIsLocal: an invalid DB_TARGET is not local", () => {
  assert.equal(databaseIsLocal({ shell: NO_SHELL, files: [envFile(".env", { target: "prod" })] }).local, false);
});

test("databaseIsLocal: DB_TARGET=oracle in any other env file", () => {
  const r = databaseIsLocal({ shell: NO_SHELL, files: [envFile(".env"), envFile(".env.local", { target: "oracle" })] });
  assert.equal(r.local, false);
  assert.match(r.reason, /\.env\.local/);
});

test("databaseIsLocal: DB_TARGET=oracle in the shell", () => {
  const r = databaseIsLocal({ shell: { DB_TARGET: "oracle" }, files: [envFile(".env")] });
  assert.equal(r.local, false);
  assert.match(r.reason, /shell/);
});

test("databaseIsLocal: shell DB_TARGET=local wins over .env's oracle (dotenv doesn't override)", () => {
  assert.equal(databaseIsLocal({ shell: { DB_TARGET: "local" }, files: [envFile(".env", { target: "oracle" })] }).local, true);
});

test("databaseIsLocal: a non-localhost LOCAL_* URL is not local", () => {
  for (const opts of [{ rw: REMOTE }, { ro: REMOTE }, { app: REMOTE }]) {
    const r = databaseIsLocal({ shell: NO_SHELL, files: [envFile(".env", opts)] });
    assert.equal(r.local, false, JSON.stringify(Object.keys(opts)));
    assert.ok(!r.reason.includes(REMOTE) && !r.reason.includes("203.0.113.7"), "reason must not leak the URL");
  }
});

test("databaseIsLocal: local .env + remote shell LOCAL_DATABASE_URL", () => {
  const r = databaseIsLocal({ shell: { [RW]: REMOTE }, files: [envFile(".env")] });
  assert.equal(r.local, false);
  assert.match(r.reason, /shell/);
  assert.ok(!r.reason.includes(REMOTE));
});

test("databaseIsLocal: remote .env + local shell value (shell wins)", () => {
  const r = databaseIsLocal({ shell: { [RW]: LOCAL }, files: [{ name: ".env", text: `${RW}=${REMOTE}` }] });
  assert.equal(r.local, true);
});

test("databaseIsLocal: shell value counts even without .env", () => {
  assert.equal(databaseIsLocal({ shell: { [RW]: LOCAL }, files: [] }).local, true);
  assert.equal(databaseIsLocal({ shell: { [RW]: REMOTE }, files: [] }).local, false);
});

test("databaseIsLocal: no LOCAL_DATABASE_URL anywhere is not local", () => {
  const r = databaseIsLocal({ shell: NO_SHELL, files: [] });
  assert.equal(r.local, false);
  assert.equal(r.reason, "no LOCAL_DATABASE_URL found");
  // The old single-set name no longer counts.
  assert.equal(databaseIsLocal({ shell: NO_SHELL, files: [{ name: ".env", text: `DATABASE_URL=${LOCAL}` }] }).local, false);
});

test("databaseIsLocal: unreadable file is not local", () => {
  const r = databaseIsLocal({ shell: { [RW]: LOCAL }, files: [envFile(".env"), { name: ".env.local", text: null }] });
  assert.equal(r.local, false);
  assert.match(r.reason, /\.env\.local/);
});

test("databaseIsLocal: remote .env.test is not local", () => {
  const r = databaseIsLocal({ shell: NO_SHELL, files: [envFile(".env"), envFile(".env.test", { rw: REMOTE })] });
  assert.equal(r.local, false);
  assert.match(r.reason, /\.env\.test/);
});

test("databaseIsLocal: duplicate key with a remote value anywhere is not local", () => {
  const r = databaseIsLocal({ shell: NO_SHELL, files: [{ name: ".env", text: `${RW}=${REMOTE}\n${RW}=${LOCAL}` }] });
  assert.equal(r.local, false);
});

test("namesOracle: true", () => {
  for (const cmd of [
    "DB_TARGET=oracle npx prisma migrate status",
    "DB_TARGET='oracle' npm run dev",
    'export DB_TARGET="oracle"',
    "echo $ORACLE_DATABASE_URL",
    "grep ORACLE_DATABASE_URL_READONLY lib",
    "npx tsx scripts/readonly/ro-query.ts --target oracle 'SELECT 1'",
    "echo $ORACLE_DB_HOST",
  ]) {
    assert.equal(namesOracle(cmd), true, cmd);
  }
});

test("namesOracle: false", () => {
  for (const cmd of ["DB_TARGET=local npm run build", "git status", "grep -n DB_TARGET lib/databaseUrl.ts", "cat lib/oracleCertCheck.ts"]) {
    assert.equal(namesOracle(cmd), false, cmd);
  }
});

test("connectsToDb: true", () => {
  for (const cmd of [
    "npm start",
    "npm run start",
    "npx tsx lib/x.ts",
    `node -e "require('./lib/prisma')"`,
    "cd scripts && npx tsx backfill.ts",
    "npx playwright test",
    "npm run test:visual",
    "npx tsx e2e/seed-test-db.ts",
    "curl -X POST http://localhost:3000/api/sync/incremental",
    "npx prisma migrate dev",
    "npm run sync:incremental",
    "npm run db:recompute-stats",
    "npm run screenshots",
    "npx tsx scripts/db/recompute-stats.ts",
    "cd scripts/sync && npx tsx backfill.ts",
    "npm run dev",
    "npx next start",
    "wget -qO- http://127.0.0.1:3000/api/db-check",
    "/usr/bin/node x.js",
    "cd a && tsx b.ts",
    `bash -c "node x.js"`,
  ]) {
    assert.equal(connectsToDb(cmd), true, cmd);
  }
});

test("connectsToDb: false", () => {
  for (const cmd of [
    "git status",
    "cat node_modules/next/dist/docs/x.md",
    "npm run lint",
    "ls scripts",
    "curl https://example.com",
    "git diff app/x.tsx",
    "cat app/components/GameReplay.tsx",
    "grep -n foo lib/x.ts app/y.tsx",
  ]) {
    assert.equal(connectsToDb(cmd), false, cmd);
  }
});
