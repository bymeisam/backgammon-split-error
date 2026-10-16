import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DB_URL_VARS } from "./databaseUrl";

// The LOCAL_* names (DB_TARGET is stubbed to local).
const V = DB_URL_VARS.local;

const gate = vi.hoisted(() => ({ galaxy: false }));
vi.mock("@/lib/galaxyGate", () => ({ isSyncEnabled: () => gate.galaxy }));

import { isAppWriteEnabled } from "./appWriteGate";

const APP_URL = "mysql://bg_db_app:pw@203.0.113.7:3306/backgammon?ssl=true";

describe("isAppWriteEnabled", () => {
  beforeEach(() => {
    vi.stubEnv("DB_TARGET", "local");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    gate.galaxy = false;
  });

  // [app URL set, NODE_ENV, isSyncEnabled] -> expected
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

  it.each(cases)("app URL set=%s, NODE_ENV=%s, galaxy=%s -> %s", (appSet, nodeEnv, galaxy, expected) => {
    vi.stubEnv(V.app, appSet ? APP_URL : undefined);
    vi.stubEnv("NODE_ENV", nodeEnv);
    gate.galaxy = galaxy;
    expect(isAppWriteEnabled()).toBe(expected);
  });

  // An empty app URL behaves exactly like an unset one.
  const emptyCases: Array<["production" | "development", boolean, boolean]> = [
    ["production", true, false],
    ["production", false, false],
    ["development", true, true],
    ["development", false, false],
  ];

  it.each(emptyCases)("empty app URL, NODE_ENV=%s, galaxy=%s -> %s", (nodeEnv, galaxy, expected) => {
    vi.stubEnv(V.app, "");
    vi.stubEnv("NODE_ENV", nodeEnv);
    gate.galaxy = galaxy;
    expect(isAppWriteEnabled()).toBe(expected);
  });
});
