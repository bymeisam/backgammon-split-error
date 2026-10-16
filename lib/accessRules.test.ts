import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { accessTierFor } from "./accessRules";

describe("accessTierFor: pages", () => {
  it.each([
    ["/sign-in", "public"],
    ["/sign-in/factor-one", "public"],
    ["/auth/complete", "public"],
    ["/", "member"],
    ["/matches", "member"],
    ["/matches/analysis", "member"],
    ["/matches/123", "member"],
    ["/matches/123/replay/2", "member"],
    ["/mistakes", "member"],
    ["/repeated-positions", "member"],
    ["/forum", "member"],
    ["/forum/new", "member"],
    ["/forum/7", "member"],
    ["/position-builder", "member"],
    ["/settings", "member"],
    ["/review", "owner"],
    ["/review/cards", "owner"],
    ["/sources", "owner"],
    ["/sources/galaxy/matches", "owner"],
    ["/galaxy/matches", "owner"],
    ["/status", "owner"],
    ["/something-new", "owner"],
    ["/mistakes/extra", "owner"],
    ["/sign-inx", "owner"],
  ] as const)("%s is %s", (path, tier) => {
    expect(accessTierFor(path)).toBe(tier);
  });
});

describe("accessTierFor: APIs", () => {
  it.each([
    ["/api/forum/posts", "member"],
    ["/api/forum/posts/3/replies", "member"],
    ["/api/forum/replies/3", "member"],
    ["/api/matches/list/1", "member"],
    ["/api/matches/123/2", "member"],
    ["/api/player-identities", "member"],
    ["/api/engine/analyze", "member"],
    ["/api/matches/check-existence", "owner"],
    ["/api/decision-notes", "owner"],
    ["/api/decisions/5/note", "owner"],
    ["/api/review/queue", "owner"],
    ["/api/tags", "owner"],
    ["/api/sync/incremental", "owner"],
    ["/api/galaxy/matches/list/1", "owner"],
    ["/api/db-check", "owner"],
    ["/api/new-thing", "owner"],
  ] as const)("%s is %s", (path, tier) => {
    expect(accessTierFor(path)).toBe(tier);
  });
});

// Every API route calls the guard for its tier in every handler, so the
// table and the routes can't drift apart.
const API_DIR = join(process.cwd(), "app", "api");

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return routeFiles(path);
    return name === "route.ts" ? [path] : [];
  });
}

function urlFor(file: string): string {
  const rel = relative(join(process.cwd(), "app"), file).split(sep).slice(0, -1);
  return `/${rel.join("/")}`;
}

describe("API routes call the guard for their tier", () => {
  const files = routeFiles(API_DIR);

  it("finds the API routes", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files.map((file) => [urlFor(file), file]))("%s", (url, file) => {
    const source = readFileSync(file, "utf8");
    const tier = accessTierFor(url);
    expect(tier).not.toBe("public");

    const handlers = source.match(/^export (async )?function (GET|POST|PUT|PATCH|DELETE)\b/gm) ?? [];
    const ownerCalls = source.match(/await requireOwnerApi\(\)/g) ?? [];
    const memberCalls = source.match(/await requireMemberApi\(\)/g) ?? [];
    expect(handlers.length).toBeGreaterThan(0);

    if (tier === "owner") {
      expect(memberCalls).toHaveLength(0);
      expect(ownerCalls).toHaveLength(handlers.length);
    } else {
      expect(ownerCalls).toHaveLength(0);
      expect(memberCalls).toHaveLength(handlers.length);
    }
  });
});

// Every page calls the document guard for its tier itself: the root
// layout's check doesn't re-run on client-side navigation, so it can't be
// the only one.
const APP_DIR = join(process.cwd(), "app");

function pageFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "api" && dir === APP_DIR ? [] : pageFiles(path);
    return name === "page.tsx" ? [path] : [];
  });
}

// The route a page file serves, as a sample URL: route groups `(x)` and
// optional catch-alls `[[...x]]` drop out, and any other dynamic segment
// (`[x]`, `[...x]`) becomes one sample segment.
function pageUrlFor(file: string): string {
  const rel = relative(APP_DIR, file).split(sep).slice(0, -1);
  const parts = rel
    .filter((part) => !/^\(.*\)$/.test(part) && !/^\[\[\.\.\..*\]\]$/.test(part))
    .map((part) => (/^\[.*\]$/.test(part) ? "sample" : part));
  return `/${parts.join("/")}`;
}

describe("pageUrlFor", () => {
  it.each([
    ["page.tsx", "/"],
    ["(group)/settings/page.tsx", "/settings"],
    ["matches/[matchId]/replay/[gameIndex]/page.tsx", "/matches/sample/replay/sample"],
    ["sign-in/[[...sign-in]]/page.tsx", "/sign-in"],
  ])("%s -> %s", (file, url) => {
    expect(pageUrlFor(join(APP_DIR, ...file.split("/")))).toBe(url);
  });
});

describe("pages call the guard for their tier", () => {
  const files = pageFiles(APP_DIR);

  it("finds the pages", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files.map((file) => [pageUrlFor(file), file]))("%s", (url, file) => {
    const source = readFileSync(file, "utf8");
    const tier = accessTierFor(url);
    const ownerCalls = source.match(/await requireOwnerDocument\(\)/g) ?? [];
    const memberCalls = source.match(/await requireMemberDocument\(\)/g) ?? [];

    if (tier === "public") {
      expect(source).not.toMatch(/requireOwnerDocument|requireMemberDocument/);
      return;
    }
    expect(source).not.toMatch(/^["']use client["']/m);
    expect(ownerCalls).toHaveLength(tier === "owner" ? 1 : 0);
    expect(memberCalls).toHaveLength(tier === "member" ? 1 : 0);
    // Inside the page component itself, not some helper above it.
    const guard = tier === "owner" ? "await requireOwnerDocument()" : "await requireMemberDocument()";
    expect(source.indexOf(guard)).toBeGreaterThan(source.indexOf("export default async function"));
    expect(source.indexOf("export default async function")).toBeGreaterThanOrEqual(0);
  });
});
