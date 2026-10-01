import { describe, expect, it } from "vitest";
import {
  classifyGameResponse,
  galaxyGamesError,
  galaxyGamesStatus,
  localGamesError,
  type GameStop,
} from "@/lib/sequentialGames";

describe("classifyGameResponse", () => {
  it("treats a 404 on game 1 as a missing match, and later as the end", () => {
    expect(classifyGameResponse(404, 1)).toBe("missing");
    expect(classifyGameResponse(404, 4)).toBe("end");
  });

  it("accepts any 2xx as a game", () => {
    expect(classifyGameResponse(200, 1)).toBe("game");
    expect(classifyGameResponse(204, 3)).toBe("game");
  });

  it("treats other statuses as failures, on any game", () => {
    expect(classifyGameResponse(500, 1)).toBe("failed");
    expect(classifyGameResponse(401, 2)).toBe("failed");
    expect(classifyGameResponse(302, 2)).toBe("failed");
  });
});

const failed = (gameIndex: number, serverMessage: string | null = null): GameStop => ({
  kind: "failed",
  gameIndex,
  status: 500,
  serverMessage,
});

describe("localGamesError", () => {
  it("reports a failure on any game with its status", () => {
    expect(localGamesError(failed(1))).toBe("Request failed (500).");
    expect(localGamesError(failed(3, "ignored"))).toBe("Request failed (500).");
  });

  it("reports network errors", () => {
    expect(localGamesError({ kind: "network", gameIndex: 2 })).toBe("Network error reading from the database.");
  });

  it("has no error for a normal end, a missing match (shown separately), or no run yet", () => {
    expect(localGamesError({ kind: "end" })).toBeNull();
    expect(localGamesError({ kind: "missing" })).toBeNull();
    expect(localGamesError(null)).toBeNull();
  });
});

describe("galaxyGamesError", () => {
  it("explains a 404 on game 1", () => {
    expect(galaxyGamesError({ kind: "missing" })).toMatch(/returned 404 for game 1/);
  });

  it("shows the server's message for a game-1 failure, else the status", () => {
    expect(galaxyGamesError(failed(1, "Upstream exploded"))).toBe("Upstream exploded");
    expect(galaxyGamesError(failed(1))).toBe("Request failed (500).");
  });

  it("treats a failure after game 1 as the end of the match, not an error", () => {
    expect(galaxyGamesError(failed(2, "later failure"))).toBeNull();
  });

  it("reports network errors on any game", () => {
    expect(galaxyGamesError({ kind: "network", gameIndex: 2 })).toBe("Network error contacting Galaxy API.");
  });

  it("has no error for a normal end or no run yet", () => {
    expect(galaxyGamesError({ kind: "end" })).toBeNull();
    expect(galaxyGamesError(null)).toBeNull();
  });
});

describe("galaxyGamesStatus", () => {
  it("shows progress while loading", () => {
    expect(galaxyGamesStatus(true, 3, 2, false)).toBe("Fetching game 3…");
  });

  it("summarizes once stopped, singular and plural", () => {
    expect(galaxyGamesStatus(false, null, 1, true)).toBe("Done — 1 game found");
    expect(galaxyGamesStatus(false, null, 3, true)).toBe("Done — 3 games found");
    expect(galaxyGamesStatus(false, null, 0, true)).toBe("Done — 0 games found");
  });

  it("is empty before any run", () => {
    expect(galaxyGamesStatus(false, null, 0, false)).toBe("");
  });
});
