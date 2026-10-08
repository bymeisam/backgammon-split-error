import { describe, expect, it } from "vitest";
import { shortcutsFor } from "./shortcuts";

const titles = (pathname: string, writeEnabled: boolean) =>
  shortcutsFor(pathname, writeEnabled).map((g) => g.title);

describe("shortcutsFor", () => {
  it("lists the replay's step keys on the replay", () => {
    expect(titles("/matches/46576635/replay/2", false)).toEqual(["Replay", "Everywhere"]);
    expect(titles("/matches/46576635/replay/2", true)).toEqual([
      "Replay",
      "Tag box (while typing a tag)",
      "Everywhere",
    ]);
    const replay = shortcutsFor("/matches/1/replay/1", false)[0];
    expect(replay.shortcuts.map((s) => s.keys)).toEqual([["←"], ["→"]]);
  });

  it("lists the review session's keys on /review in write mode only", () => {
    expect(titles("/review", true)).toEqual(["Review session", "Tag box (while typing a tag)", "Everywhere"]);
    expect(titles("/review", false)).toEqual(["Everywhere"]);
    const review = shortcutsFor("/review", true)[0];
    expect(review.shortcuts.flatMap((s) => s.keys)).toEqual(["1", "…", "5", "h", "g", "Enter", "e", "Enter"]);
  });

  it("lists the tag box on the DB-backed boards in write mode", () => {
    for (const path of ["/mistakes", "/repeated-positions", "/matches/46576635"]) {
      expect(titles(path, true)).toEqual(["Tag box (while typing a tag)", "Everywhere"]);
      expect(titles(path, false)).toEqual(["Everywhere"]);
    }
  });

  it("lists only the help keys elsewhere", () => {
    for (const path of ["/", "/matches", "/matches/analysis", "/review/cards", "/galaxy/matches/1", "/status"]) {
      expect(titles(path, true)).toEqual(["Everywhere"]);
    }
  });
});
