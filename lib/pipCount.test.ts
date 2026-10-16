import { describe, expect, it } from "vitest";
import { emptyPosition, startingPosition } from "./positionBuilder";
import { pipCounts } from "./pipCount";

describe("pipCounts", () => {
  it("starting position: 167 / 167", () => {
    expect(pipCounts(startingPosition())).toEqual({ mine: 167, opponent: 167 });
  });

  it("a side with every checker borne off counts 0", () => {
    expect(pipCounts(emptyPosition())).toEqual({ mine: 0, opponent: 0 });
    const p = emptyPosition();
    p.opponent[23] = 2; // opponent's own ace point (mine's point 24): 1 pip each
    p.opponentOff = 13;
    expect(pipCounts(p)).toEqual({ mine: 0, opponent: 2 });
  });

  it("counts a checker on the bar as 25 pips", () => {
    const p = startingPosition();
    // One of mine's back checkers (point 24) hit: 24 -> bar adds 1 pip.
    p.mine[23] = 1;
    p.mineBar = 1;
    // One of the opponent's back checkers (mine's point 1, its own 24) hit.
    p.opponent[0] = 1;
    p.opponentBar = 2;
    p.opponent[18] = 4; // and one from its 6 point (6 pips) also on the bar
    expect(pipCounts(p)).toEqual({ mine: 168, opponent: 167 + 1 + 19 });
  });
});
