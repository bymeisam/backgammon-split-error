// Run: node --test .claude/hooks/developer-guard-lib.test.mjs
// In-memory strings only — no env files are created on disk.
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDatabaseUrls, isLocalUrl, databaseIsLocal, connectsToDb } from "./developer-guard-lib.mjs";

const LOCAL = "mysql://app:pw@localhost:3306/app_dev";
const REMOTE = "mysql://bg_db_rw:pw@203.0.113.7:3306/backgammon?ssl=true";

test("parseDatabaseUrls: plain", () => {
  assert.deepEqual(parseDatabaseUrls(`DATABASE_URL=${LOCAL}`), [LOCAL]);
});

test("parseDatabaseUrls: export and whitespace around =", () => {
  assert.deepEqual(parseDatabaseUrls(`export DATABASE_URL = ${REMOTE}`), [REMOTE]);
});

test("parseDatabaseUrls: double and single quotes", () => {
  assert.deepEqual(parseDatabaseUrls(`DATABASE_URL="${LOCAL}"\nDATABASE_URL='${REMOTE}'`), [LOCAL, REMOTE]);
});

test("parseDatabaseUrls: commented lines ignored", () => {
  assert.deepEqual(parseDatabaseUrls(`# DATABASE_URL=${REMOTE}\n  #DATABASE_URL=${REMOTE}\nDATABASE_URL=${LOCAL}`), [LOCAL]);
});

test("parseDatabaseUrls: duplicate key returns both, in order", () => {
  assert.deepEqual(parseDatabaseUrls(`DATABASE_URL=${LOCAL}\nOTHER=1\nDATABASE_URL=${REMOTE}`), [LOCAL, REMOTE]);
});

test("parseDatabaseUrls: DATABASE_URL_READONLY and other DATABASE_URL_* keys ignored", () => {
  assert.deepEqual(parseDatabaseUrls(`DATABASE_URL_READONLY=${REMOTE}\nDATABASE_URL_FOO=${REMOTE}\nORACLE_DATABASE_URL_READONLY=${REMOTE}`), []);
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

const env = (name, url) => ({ name, text: `FOO=bar\nDATABASE_URL="${url}"\n` });

test("databaseIsLocal: all local", () => {
  const r = databaseIsLocal({ shellValue: undefined, files: [env(".env", LOCAL), env(".env.local", LOCAL), env(".env.test", "mysql://u:p@127.0.0.1/bg_test")] });
  assert.equal(r.local, true);
});

test("databaseIsLocal: remote .env", () => {
  const r = databaseIsLocal({ shellValue: undefined, files: [env(".env", REMOTE)] });
  assert.equal(r.local, false);
  assert.match(r.reason, /\.env/);
  assert.ok(!r.reason.includes(REMOTE) && !r.reason.includes("203.0.113.7"), "reason must not leak the URL");
});

test("databaseIsLocal: local .env + remote .env.local", () => {
  const r = databaseIsLocal({ shellValue: undefined, files: [env(".env", LOCAL), env(".env.local", REMOTE)] });
  assert.equal(r.local, false);
  assert.match(r.reason, /\.env\.local/);
});

test("databaseIsLocal: local .env + remote shell value", () => {
  const r = databaseIsLocal({ shellValue: REMOTE, files: [env(".env", LOCAL)] });
  assert.equal(r.local, false);
  assert.match(r.reason, /shell/);
  assert.ok(!r.reason.includes(REMOTE));
});

test("databaseIsLocal: remote .env + local shell value (shell wins)", () => {
  const r = databaseIsLocal({ shellValue: LOCAL, files: [env(".env", REMOTE)] });
  assert.equal(r.local, true);
});

test("databaseIsLocal: shell value counts even without .env", () => {
  assert.equal(databaseIsLocal({ shellValue: LOCAL, files: [] }).local, true);
  assert.equal(databaseIsLocal({ shellValue: REMOTE, files: [] }).local, false);
});

test("databaseIsLocal: no files and no shell is not local", () => {
  const r = databaseIsLocal({ shellValue: undefined, files: [] });
  assert.equal(r.local, false);
  assert.equal(r.reason, "no DATABASE_URL found");
});

test("databaseIsLocal: unreadable file is not local", () => {
  const r = databaseIsLocal({ shellValue: LOCAL, files: [env(".env", LOCAL), { name: ".env.local", text: null }] });
  assert.equal(r.local, false);
  assert.match(r.reason, /\.env\.local/);
});

test("databaseIsLocal: remote .env.test is not local", () => {
  const r = databaseIsLocal({ shellValue: undefined, files: [env(".env", LOCAL), env(".env.test", REMOTE)] });
  assert.equal(r.local, false);
  assert.match(r.reason, /\.env\.test/);
});

test("databaseIsLocal: duplicate key with a remote value anywhere is not local", () => {
  const r = databaseIsLocal({ shellValue: undefined, files: [{ name: ".env", text: `DATABASE_URL=${REMOTE}\nDATABASE_URL=${LOCAL}` }] });
  assert.equal(r.local, false);
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
    "npm run dev",
    "npx next start",
    "wget -qO- http://127.0.0.1:3000/api/db-check",
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
  ]) {
    assert.equal(connectsToDb(cmd), false, cmd);
  }
});
