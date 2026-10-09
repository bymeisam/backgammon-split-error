import { describe, expect, it } from "vitest";
import { shortcutsFor } from "./shortcuts";

const titles = (pathname: string, writeEnabled: boolean) =>
  shortcutsFor(pathname, writeEnabled).map((g) => g.title);

describe("shortcutsFor", () => {
  it("lists the replay's step keys on the replay", () => {
    expect(titles("/matches/46576635/replay/2", false)).toEqual(["Replay", "Move table", "Everywhere"]);
    expect(titles("/matches/46576635/replay/2", true)).toEqual([
      "Replay",
      "Move table",
      "Tag box (while typing a tag)",
      "Everywhere",
    ]);
    const [replay, moveTable] = shortcutsFor("/matches/1/replay/1", false);
    expect(replay.shortcuts.map((s) => s.keys)).toEqual([
      ["↓", "J"],
      ["↑", "K"],
      ["←", "H"],
      ["→", "L"],
      ["Shift+↓", "Shift+J"],
      ["Shift+↑", "Shift+K"],
    ]);
    expect(replay.shortcuts.every((s) => s.alternatives)).toBe(true);
    // ← / → no longer step: they're the Played / Best tabs.
    expect(replay.shortcuts.find((s) => s.keys[0] === "←")?.description).toMatch(/my move/);
    expect(replay.shortcuts.find((s) => s.keys[0] === "→")?.description).toMatch(/best move/);
    // The replay's row keys are in its own group, not repeated here.
    expect(moveTable.shortcuts.map((s) => s.keys)).toEqual([["Tab"], ["Enter", "Space"]]);
  });

  it("lists the row and tab keys, with their vim keys, on the other move-table pages", () => {
    for (const path of ["/mistakes", "/repeated-positions", "/matches/46576635", "/sources/galaxy/matches/1"]) {
      const moveTable = shortcutsFor(path, false)[0];
      expect(moveTable.title).toBe("Move table");
      expect(moveTable.shortcuts.map((s) => s.keys)).toEqual([
        ["↓", "J"],
        ["↑", "K"],
        ["←", "H"],
        ["→", "L"],
        ["Tab"],
        ["Enter", "Space"],
      ]);
      // No mistake jump outside the replay.
      expect(moveTable.shortcuts.flatMap((s) => s.keys).some((k) => k.startsWith("Shift"))).toBe(false);
    }
  });

  it("lists no Move table group on /review (its keys are in the Review session group)", () => {
    expect(titles("/review", true)).not.toContain("Move table");
  });

  it("lists the move list and, in write mode, the tag box on the DB-backed boards", () => {
    for (const path of ["/mistakes", "/repeated-positions", "/matches/46576635"]) {
      expect(titles(path, true)).toEqual(["Move table", "Tag box (while typing a tag)", "Everywhere"]);
      expect(titles(path, false)).toEqual(["Move table", "Everywhere"]);
    }
  });

  it("lists the move list, but no tag box, on a Galaxy match page", () => {
    expect(titles("/sources/galaxy/matches/1", true)).toEqual(["Move table", "Everywhere"]);
  });

  it("lists only the help keys elsewhere", () => {
    for (const path of ["/", "/matches", "/matches/analysis", "/review/cards", "/sources/galaxy/matches", "/status"]) {
      expect(titles(path, true)).toEqual(["Everywhere"]);
    }
  });
});
