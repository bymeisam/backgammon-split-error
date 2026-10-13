import { afterEach, describe, expect, it, vi } from "vitest";

const gate = vi.hoisted(() => ({ galaxy: false }));
vi.mock("@/lib/galaxyGate", () => ({ isGalaxyEnabled: () => gate.galaxy }));

import { isForumWriteEnabled } from "./forumGate";

const FORUM_URL = "mysql://bg_db_forum:pw@203.0.113.7:3306/backgammon?ssl=true";

describe("isForumWriteEnabled", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    gate.galaxy = false;
  });

  // [DATABASE_URL_FORUM set, NODE_ENV, isGalaxyEnabled] -> expected
  const cases: Array<[boolean, "production" | "development", boolean, boolean]> = [
    [true, "production", true, true],
    [true, "production", false, true],
    [true, "development", true, true],
    [true, "development", false, true],
    [false, "production", true, false],
    [false, "production", false, false],
    [false, "development", true, true],
    [false, "development", false, false],
  ];

  it.each(cases)("forum URL set=%s, NODE_ENV=%s, galaxy=%s -> %s", (forumSet, nodeEnv, galaxy, expected) => {
    vi.stubEnv("DATABASE_URL_FORUM", forumSet ? FORUM_URL : undefined);
    vi.stubEnv("NODE_ENV", nodeEnv);
    gate.galaxy = galaxy;
    expect(isForumWriteEnabled()).toBe(expected);
  });

  it("treats an empty DATABASE_URL_FORUM as unset", () => {
    vi.stubEnv("DATABASE_URL_FORUM", "");
    vi.stubEnv("NODE_ENV", "production");
    gate.galaxy = true;
    expect(isForumWriteEnabled()).toBe(false);
  });
});
