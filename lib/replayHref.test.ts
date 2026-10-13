import { describe, expect, it } from "vitest";
import { replayHref } from "./replayHref";

describe("replayHref", () => {
  it("builds the replay URL on one decision", () => {
    expect(replayHref("40310886", 3, 1149340)).toBe("/matches/40310886/replay/3?decision=1149340");
  });

  it("encodes the match id and accepts a string decision id", () => {
    expect(replayHref("a/b c", 1, "7")).toBe("/matches/a%2Fb%20c/replay/1?decision=7");
  });
});
