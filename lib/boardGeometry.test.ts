import { describe, expect, it } from "vitest";
import {
  BAR_COL,
  BOARD_H,
  BOARD_W,
  CUBE_BADGE_R,
  CUBE_COL_W,
  DIE_SIZE,
  MARGIN_X,
  MAX_STACK,
  OFF_TRACK_W,
  OFF_TRACK_X,
  OFF_COL,
  OFF_SLOTS,
  ROW_H,
  Y0,
  Y1,
  barStackBase,
  colCenterX,
  colX,
  cubeBadgeCenter,
  diePips,
  diePosition,
  offTrayRect,
  offeredCubeCenter,
  isOffSlotFilled,
  moveAnchor,
  nextOffSlotIndex,
  offColumnGeometry,
  offTrayBounds,
  pointColumn,
  pointRow,
  stackBase,
  stackSlotY,
  trianglePoints,
  type Side,
} from "@/lib/boardGeometry";
import { decodeGnuPositionId, flipPerspective, type DecodedPosition } from "@/lib/gnuPositionId";
import { mirrorSubMoves } from "@/lib/backgammonNotation";

const CENTER_Y = Y0 + ROW_H;
const POINTS = Array.from({ length: 24 }, (_, i) => i + 1);
const SIDES: Side[] = ["mine", "opponent"];
// Same real Position IDs lib/gnuPositionId.test.ts uses (starting position
// + match 46576635 game 1).
const REAL_POSITION_IDS = ["4HPwATDgc/ABMA", "4PPCATDgc/ABMA", "sNsmARTYzuABMA"];

function emptyPosition(overrides: Partial<DecodedPosition> = {}): DecodedPosition {
  return {
    mine: new Array(24).fill(0),
    opponent: new Array(24).fill(0),
    mineBar: 0,
    opponentBar: 0,
    mineOff: 0,
    opponentOff: 0,
    ...overrides,
  };
}

function withPoint(arr: "mine" | "opponent", point: number, count: number, pos = emptyPosition()) {
  const next = { ...pos, [arr]: [...pos[arr]] };
  next[arr][point - 1] = count;
  return next;
}

// Which off-tray slot an anchor y lands in, for the given side.
function offSlotAt(y: number, side: Side): number {
  const { topY, bottomY, badgeAtBottom } = offTrayBounds(side);
  const { trackTop, slotSpan } = offColumnGeometry(topY, bottomY, badgeAtBottom);
  return Math.round((y - trackTop - slotSpan / 2) / slotSpan);
}

// The Clubroom mockup's board (design/mockups/replay.html's board(); the
// fidelity spec's §2.1 table).
describe("Clubroom board geometry", () => {
  it("has the mockup's 562 × 380 board and its column edges", () => {
    expect([BOARD_W, BOARD_H]).toEqual([562, 380]);
    expect(colX(0)).toBe(44);
    expect(colX(BAR_COL)).toBe(260);
    expect(colX(BAR_COL + 1)).toBe(290);
    expect(colX(OFF_COL)).toBe(506);
    expect([Y0, Y1]).toEqual([20, 360]);
  });

  it("puts points where the mockup's px() does, with 17u half-width triangles 148u tall", () => {
    const mockupX = (p: number) =>
      p >= 19 ? 290 + 18 + (p - 19) * 36 : p >= 13 ? 44 + 18 + (p - 13) * 36 : p >= 7 ? 44 + 18 + (12 - p) * 36 : 290 + 18 + (6 - p) * 36;
    for (const p of POINTS) expect(stackBase(p).cx).toBe(mockupX(p));
    expect(trianglePoints(1)).toBe("471,360 505,360 488,212");
    expect(trianglePoints(13)).toBe("45,20 79,20 62,168");
  });

  it("stacks checkers 32u apart from 17u inside the edge (the mockup's cy)", () => {
    expect([stackSlotY(stackBase(1), 0), stackSlotY(stackBase(1), 4)]).toEqual([343, 215]);
    expect([stackSlotY(stackBase(24), 0), stackSlotY(stackBase(24), 4)]).toEqual([37, 165]);
    expect(barStackBase("mine").cx).toBe(275);
  });

  it("draws the 34u trays at x=514, 8u apart across the centre line", () => {
    expect(offTrayRect("opponent")).toEqual({ x: 514, y: 20, width: 34, height: 166 });
    expect(offTrayRect("mine")).toEqual({ x: 514, y: 194, width: 34, height: 166 });
    expect([OFF_TRACK_X, OFF_TRACK_W]).toEqual([519, 24]);
    expect(offTrayBounds("opponent")).toEqual({ topY: 24, bottomY: 182, badgeAtBottom: true });
    expect(offTrayBounds("mine")).toEqual({ topY: 198, bottomY: 356, badgeAtBottom: false });
  });

  it("places the 26u cube at x=16 in the gutter: y 177 centred, 24 opponent, 330 mine", () => {
    const rectY = (owner: "center" | Side) => cubeBadgeCenter(owner).y - CUBE_BADGE_R;
    expect(cubeBadgeCenter("center").x - CUBE_BADGE_R).toBe(16);
    expect([rectY("center"), rectY("opponent"), rectY("mine")]).toEqual([177, 24, 330]);
    expect([offeredCubeCenter("mine"), offeredCubeCenter("opponent")]).toEqual([
      { x: 275, y: 345 },
      { x: 275, y: 35 },
    ]);
  });

  it("centres the two 26u dice, 8u apart, on the right half at y=190", () => {
    expect(DIE_SIZE).toBe(26);
    expect(diePosition(0)).toEqual({ x: 368, y: 177 });
    expect(diePosition(1)).toEqual({ x: 402, y: 177 });
  });

  it("has value-many pips for 1-6 and none otherwise", () => {
    for (let v = 1; v <= 6; v++) expect(diePips(v)).toHaveLength(v);
    for (const v of [0, 7, 2.5, NaN, "toString" as unknown as number]) expect(diePips(v)).toEqual([]);
  });
});

describe("pointColumn / pointRow", () => {
  it("never places a point in the bar or off-tray column", () => {
    for (const p of POINTS) {
      expect(pointColumn(p)).toBeGreaterThanOrEqual(0);
      expect(pointColumn(p)).toBeLessThan(OFF_COL);
      expect(pointColumn(p)).not.toBe(BAR_COL);
    }
  });

  it("gives each column exactly one bottom-row and one top-row point", () => {
    const seen = new Map<string, number>();
    for (const p of POINTS) {
      const key = `${pointColumn(p)}:${pointRow(p)}`;
      expect(seen.has(key)).toBe(false);
      seen.set(key, p);
    }
    expect(seen.size).toBe(24);
  });

  it("lays out the standard orientation: 1 bottom-right, 12 bottom-left, 13 top-left, 24 top-right", () => {
    expect([pointColumn(1), pointRow(1)]).toEqual([12, "bottom"]);
    expect([pointColumn(12), pointRow(12)]).toEqual([0, "bottom"]);
    expect([pointColumn(13), pointRow(13)]).toEqual([0, "top"]);
    expect([pointColumn(24), pointRow(24)]).toEqual([12, "top"]);
  });

  // The property mirrorSubMoves (25 - n) relies on: mirroring a point keeps
  // it in the same column and moves it to the other row.
  it("maps point p and its mirror 25-p to the same column, opposite rows", () => {
    for (const p of POINTS) {
      expect(pointColumn(25 - p)).toBe(pointColumn(p));
      expect(pointRow(25 - p)).not.toBe(pointRow(p));
    }
  });
});

describe("stackBase / barStackBase / stackSlotY", () => {
  it("grows bottom-row stacks upward and top-row stacks downward", () => {
    for (const p of POINTS) {
      const base = stackBase(p);
      if (pointRow(p) === "bottom") {
        expect(base.dir).toBe(-1);
        expect(base.baseY).toBeGreaterThan(CENTER_Y);
      } else {
        expect(base.dir).toBe(1);
        expect(base.baseY).toBeLessThan(CENTER_Y);
      }
    }
  });

  it("puts mine's bar stack in the bottom half and the opponent's in the top half", () => {
    const mine = barStackBase("mine");
    const opp = barStackBase("opponent");
    expect(mine.cx).toBe(colCenterX(BAR_COL));
    expect(opp.cx).toBe(colCenterX(BAR_COL));
    // Same origins as point stacks in the matching half.
    expect([mine.baseY, mine.dir]).toEqual([stackBase(1).baseY, stackBase(1).dir]);
    expect([opp.baseY, opp.dir]).toEqual([stackBase(24).baseY, stackBase(24).dir]);
    expect(mine.baseY).toBeGreaterThan(CENTER_Y);
    expect(opp.baseY).toBeLessThan(CENTER_Y);
  });

  it("keeps every drawn stack slot within its own half of the board", () => {
    for (const base of [stackBase(1), barStackBase("mine")]) {
      for (let i = 0; i < MAX_STACK; i++) expect(stackSlotY(base, i)).toBeGreaterThan(CENTER_Y);
    }
    for (const base of [stackBase(24), barStackBase("opponent")]) {
      for (let i = 0; i < MAX_STACK; i++) expect(stackSlotY(base, i)).toBeLessThan(CENTER_Y);
    }
  });

  it("clamps below 0 to the base and past the last drawn checker to it", () => {
    const base = stackBase(6);
    expect(stackSlotY(base, -1)).toBe(stackSlotY(base, 0));
    expect(stackSlotY(base, MAX_STACK + 3)).toBe(stackSlotY(base, MAX_STACK - 1));
  });
});

describe("off tray geometry", () => {
  it("keeps mine's tray in the bottom half and the opponent's in the top half", () => {
    expect(offTrayBounds("mine").topY).toBeGreaterThan(CENTER_Y);
    expect(offTrayBounds("opponent").bottomY).toBeLessThan(CENTER_Y);
  });

  it("fits the badge and all slots inside each side's bounds, badge nearest the center line", () => {
    for (const side of SIDES) {
      const { topY, bottomY, badgeAtBottom } = offTrayBounds(side);
      const g = offColumnGeometry(topY, bottomY, badgeAtBottom);
      expect(g.trackTop).toBeGreaterThanOrEqual(topY);
      expect(g.trackTop + OFF_SLOTS * g.slotSpan).toBeCloseTo(g.trackBottom);
      expect(g.trackBottom).toBeLessThanOrEqual(bottomY);
      expect(g.badgeCy - g.badgeR).toBeGreaterThanOrEqual(topY);
      expect(g.badgeCy + g.badgeR).toBeLessThanOrEqual(bottomY);
      if (side === "mine") expect(g.badgeCy).toBeLessThan(g.trackTop); // badge on top, near center
      else expect(g.badgeCy).toBeGreaterThan(g.trackBottom); // badge at bottom, near center
    }
  });

  it("fills exactly `count` slots, contiguously from the end away from the badge", () => {
    for (const side of SIDES) {
      const { badgeAtBottom } = offTrayBounds(side);
      for (let count = 0; count <= OFF_SLOTS; count++) {
        const filled = Array.from({ length: OFF_SLOTS }, (_, i) => isOffSlotFilled(i, count, badgeAtBottom));
        expect(filled.filter(Boolean).length).toBe(count);
        // Far end: slot 0 (top) when the badge is at the bottom, else the last slot.
        const farEnd = badgeAtBottom ? filled : [...filled].reverse();
        expect(farEnd.slice(0, count).every(Boolean)).toBe(true);
      }
    }
  });

  it("points the next-slot index at the first empty slot, right next to the filled ones", () => {
    for (const side of SIDES) {
      const { badgeAtBottom } = offTrayBounds(side);
      for (let count = 0; count < OFF_SLOTS; count++) {
        const next = nextOffSlotIndex(count, badgeAtBottom);
        expect(isOffSlotFilled(next, count, badgeAtBottom)).toBe(false);
        if (count > 0) {
          const towardFarEnd = badgeAtBottom ? next - 1 : next + 1;
          expect(isOffSlotFilled(towardFarEnd, count, badgeAtBottom)).toBe(true);
        }
      }
      // All 15 off: clamped onto the track rather than past it.
      const full = nextOffSlotIndex(OFF_SLOTS, badgeAtBottom);
      expect(full).toBeGreaterThanOrEqual(0);
      expect(full).toBeLessThan(OFF_SLOTS);
    }
  });
});

describe("moveAnchor — unflipped (mover's checkers in decoded.mine)", () => {
  it("anchors a point origin on the top checker and its destination on the next free slot", () => {
    const pos = withPoint("mine", 8, 3);
    const base = stackBase(8);
    expect(moveAnchor(8, pos, true, false)).toEqual({ x: base.cx, y: stackSlotY(base, 2) });
    expect(moveAnchor(8, pos, false, false)).toEqual({ x: base.cx, y: stackSlotY(base, 3) });
  });

  it("ignores decoded.opponent at the same point", () => {
    const pos = withPoint("opponent", 8, 4, withPoint("mine", 8, 1));
    expect(moveAnchor(8, pos, true, false).y).toBe(stackSlotY(stackBase(8), 0));
  });

  it("anchors bar moves in the bottom half from mineBar", () => {
    const pos = emptyPosition({ mineBar: 2, opponentBar: 4 });
    const a = moveAnchor("bar", pos, true, false);
    expect(a).toEqual({ x: colCenterX(BAR_COL), y: stackSlotY(barStackBase("mine"), 1) });
    expect(a.y).toBeGreaterThan(CENTER_Y);
  });

  it("anchors bear-offs on mine's next empty off slot, in the bottom half", () => {
    const pos = emptyPosition({ mineOff: 3, opponentOff: 9 });
    const a = moveAnchor("off", pos, false, false);
    expect(a.y).toBeGreaterThan(CENTER_Y);
    expect(offSlotAt(a.y, "mine")).toBe(nextOffSlotIndex(3, false));
  });
});

// The historical bug (PROGRESS.md 2026-10-01): moveAnchor always read the
// mine side, so on a flipped board — where the mover's checkers live in
// decoded.opponent and its bar/off-tray in the top half — arrows anchored at
// the wrong stack height or in the wrong half entirely. Each case below
// mirrors one of the three real decisions that bug was confirmed on.
describe("moveAnchor — flipped (mover's checkers in decoded.opponent)", () => {
  it("reads stack height from decoded.opponent, not decoded.mine (decision 2524, point case)", () => {
    // 2524: decoded.mine[16] = 0 while decoded.opponent[16] = 3.
    const pos = withPoint("opponent", 17, 3);
    const base = stackBase(17);
    const origin = moveAnchor(17, pos, true, true);
    expect(origin).toEqual({ x: base.cx, y: stackSlotY(base, 2) });
    // What the buggy mine-side read produced — must differ.
    expect(origin).not.toEqual(moveAnchor(17, pos, true, false));
    expect(moveAnchor(17, pos, false, true).y).toBe(stackSlotY(base, 3));
  });

  it("anchors bar moves in the top half from opponentBar (decision 2540, bar case)", () => {
    const pos = emptyPosition({ mineBar: 0, opponentBar: 1 });
    const a = moveAnchor("bar", pos, true, true);
    expect(a).toEqual({ x: colCenterX(BAR_COL), y: stackSlotY(barStackBase("opponent"), 0) });
    expect(a.y).toBeLessThan(CENTER_Y);
  });

  it("anchors bear-offs in the opponent's top-half tray from opponentOff (decision 672276, off case)", () => {
    const pos = emptyPosition({ mineOff: 0, opponentOff: 2 });
    const a = moveAnchor("off", pos, false, true);
    expect(a.y).toBeLessThan(CENTER_Y);
    expect(offSlotAt(a.y, "opponent")).toBe(nextOffSlotIndex(2, true));
    expect(isOffSlotFilled(offSlotAt(a.y, "opponent"), 2, true)).toBe(false);
  });

  // End to end, the way BoardPanel feeds Board: a real position from the
  // mover's own frame, flipPerspective'd, with the sub-move mirrorSubMoves'd.
  // The flipped arrow must still start on the mover's own top checker —
  // which is now drawn in the opponent color, in the mirrored row.
  it("anchors every real point origin on the mover's top checker after flip + mirror", () => {
    let discriminating = 0;
    for (const id of REAL_POSITION_IDS) {
      const raw = decodeGnuPositionId(id);
      const flipped = flipPerspective(raw);
      for (const p of POINTS) {
        const count = raw.mine[p - 1];
        if (count === 0) continue;
        const [move] = mirrorSubMoves([{ from: p, to: "off", hit: false, count: 1 }]);
        const mirrored = 25 - p;
        expect(move.from).toBe(mirrored);

        const anchor = moveAnchor(move.from, flipped, true, true);
        const base = stackBase(mirrored);
        expect(anchor).toEqual({ x: base.cx, y: stackSlotY(base, count - 1) });
        // Same column as the unflipped arrow, other row.
        expect(anchor.x).toBe(moveAnchor(p, raw, true, false).x);
        expect(Math.sign(anchor.y - CENTER_Y)).toBe(-Math.sign(moveAnchor(p, raw, true, false).y - CENTER_Y));

        if (moveAnchor(move.from, flipped, true, false).y !== anchor.y) discriminating++;
      }
    }
    // The real data must include cases where the old mine-side read lands
    // elsewhere, or this test couldn't have caught the original bug.
    expect(discriminating).toBeGreaterThan(0);
  });

  it("anchors bar entry and bear-off for the mover's own counts after flip", () => {
    const raw = emptyPosition({ mineBar: 2, opponentBar: 0, mineOff: 4, opponentOff: 1 });
    const flipped = flipPerspective(raw);

    const bar = moveAnchor("bar", flipped, true, true);
    expect(bar.y).toBe(stackSlotY(barStackBase("opponent"), raw.mineBar - 1));
    expect(bar.y).toBeLessThan(CENTER_Y);

    const off = moveAnchor("off", flipped, false, true);
    expect(off.y).toBeLessThan(CENTER_Y);
    expect(offSlotAt(off.y, "opponent")).toBe(nextOffSlotIndex(raw.mineOff, true));
  });
});

describe("cube gutter / cubeBadgeCenter", () => {
  it("shifts the whole grid right by CUBE_COL_W, leaving relative column spacing untouched", () => {
    const unshiftedBarX = MARGIN_X + 6 * 36; // 6 point columns (POINT_W=36) before the bar, pre-gutter
    expect(colX(BAR_COL)).toBe(unshiftedBarX + CUBE_COL_W);
  });

  it("centers the cube on the board's own dividing line when owner is center", () => {
    const { y } = cubeBadgeCenter("center");
    expect(y).toBe(CENTER_Y);
  });

  it("positions the cube in the opponent's half (near the top edge) when owner is opponent", () => {
    const { y } = cubeBadgeCenter("opponent");
    expect(y).toBeGreaterThan(Y0);
    expect(y).toBeLessThan(CENTER_Y);
  });

  it("positions the cube in mine's half (near the bottom edge) when owner is mine", () => {
    const { y } = cubeBadgeCenter("mine");
    expect(y).toBeGreaterThan(CENTER_Y);
    expect(y).toBeLessThan(Y1);
  });

  it("keeps the same x regardless of owner — only y (the side) moves", () => {
    const { x: xCenter } = cubeBadgeCenter("center");
    const { x: xMine } = cubeBadgeCenter("mine");
    const { x: xOpponent } = cubeBadgeCenter("opponent");
    expect(xMine).toBe(xCenter);
    expect(xOpponent).toBe(xCenter);
  });

  it("sits left of the main grid, inside the new gutter", () => {
    const { x } = cubeBadgeCenter("center");
    expect(x).toBeGreaterThan(MARGIN_X);
    expect(x).toBeLessThan(MARGIN_X + CUBE_COL_W);
    expect(x).toBeLessThan(colX(0));
  });
});

describe("offeredCubeCenter — the offered cube on a take/pass board", () => {
  it("is centred horizontally on the playing field (the bar column)", () => {
    expect(offeredCubeCenter("mine").x).toBe(colCenterX(BAR_COL));
    expect(offeredCubeCenter("opponent").x).toBe(colCenterX(BAR_COL));
  });

  it("sits flush against the receiver's edge: bottom for mine, top for opponent", () => {
    expect(offeredCubeCenter("mine").y).toBe(Y1 - CUBE_BADGE_R - 2);
    expect(offeredCubeCenter("opponent").y).toBe(Y0 + CUBE_BADGE_R + 2);
  });
});
