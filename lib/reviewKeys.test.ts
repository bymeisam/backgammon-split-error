import { describe, expect, it } from "vitest";
import { reviewKeyAction, type ReviewKeyContext } from "./reviewKeys";

const front: ReviewKeyContext = { side: "front", optionCount: 4 };
const backRight = (saveKind: "idle" | "saving" | "saved" | "error" = "idle", hasTabs = true): ReviewKeyContext => ({
  side: "back",
  correct: true,
  saveKind,
  hasTabs,
});
const backWrong = (saveKind: "idle" | "saving" | "saved" | "error", hasTabs = true): ReviewKeyContext => ({
  side: "back",
  correct: false,
  saveKind,
  hasTabs,
});

describe("reviewKeyAction: the front", () => {
  it("moves the focus with ↓/j and ↑/k", () => {
    expect(reviewKeyAction("ArrowDown", false, front)).toEqual({ type: "moveFocus", direction: 1 });
    expect(reviewKeyAction("j", false, front)).toEqual({ type: "moveFocus", direction: 1 });
    expect(reviewKeyAction("ArrowUp", false, front)).toEqual({ type: "moveFocus", direction: -1 });
    expect(reviewKeyAction("k", false, front)).toEqual({ type: "moveFocus", direction: -1 });
  });

  it("chooses an option by its number, up to the option count", () => {
    expect(reviewKeyAction("1", false, front)).toEqual({ type: "choose", index: 0 });
    expect(reviewKeyAction("4", false, front)).toEqual({ type: "choose", index: 3 });
    expect(reviewKeyAction("5", false, front)).toBeNull();
    expect(reviewKeyAction("0", false, front)).toBeNull();
  });

  it("leaves Enter and Space to the focused button, and doesn't rate", () => {
    expect(reviewKeyAction("Enter", false, front)).toBeNull();
    expect(reviewKeyAction(" ", false, front)).toBeNull();
    expect(reviewKeyAction("G", true, front)).toBeNull();
    expect(reviewKeyAction("h", false, front)).toBeNull();
    expect(reviewKeyAction("ArrowLeft", false, front)).toBeNull();
  });
});

describe("reviewKeyAction: the back", () => {
  it("rates with Shift+H / Shift+G / Shift+E and Enter after a right answer", () => {
    expect(reviewKeyAction("H", true, backRight())).toEqual({ type: "rate", rating: "hard" });
    expect(reviewKeyAction("G", true, backRight())).toEqual({ type: "rate", rating: "good" });
    expect(reviewKeyAction("Enter", false, backRight())).toEqual({ type: "rate", rating: "good" });
    expect(reviewKeyAction("E", true, backRight())).toEqual({ type: "rate", rating: "easy" });
  });

  it("doesn't rate with plain g / e (and plain h is the Yours tab)", () => {
    expect(reviewKeyAction("g", false, backRight())).toBeNull();
    expect(reviewKeyAction("e", false, backRight())).toBeNull();
    expect(reviewKeyAction("h", false, backRight())).toEqual({ type: "tab", tab: "my" });
    expect(reviewKeyAction("h", false, backRight("idle", false))).toBeNull();
  });

  it("doesn't rate while the answer is saving", () => {
    expect(reviewKeyAction("G", true, backRight("saving"))).toBeNull();
    expect(reviewKeyAction("Enter", false, backRight("saving"))).toBeNull();
  });

  it("switches the Yours / Best tabs with ←/h and →/l, only where the tabs exist", () => {
    expect(reviewKeyAction("ArrowLeft", false, backRight())).toEqual({ type: "tab", tab: "my" });
    expect(reviewKeyAction("ArrowRight", false, backRight())).toEqual({ type: "tab", tab: "best" });
    expect(reviewKeyAction("l", false, backWrong("saved"))).toEqual({ type: "tab", tab: "best" });
    expect(reviewKeyAction("ArrowLeft", true, backRight())).toBeNull();
    expect(reviewKeyAction("ArrowRight", false, backRight("idle", false))).toBeNull();
  });

  it("goes to the next card with Enter after a wrong answer, once it's saved", () => {
    expect(reviewKeyAction("Enter", false, backWrong("saved"))).toEqual({ type: "next" });
    expect(reviewKeyAction("Enter", false, backWrong("saving"))).toBeNull();
    expect(reviewKeyAction("Enter", false, backWrong("error"))).toBeNull();
    expect(reviewKeyAction("G", true, backWrong("saved"))).toBeNull();
  });

  it("doesn't move through options on the back", () => {
    expect(reviewKeyAction("j", false, backRight())).toBeNull();
    expect(reviewKeyAction("ArrowDown", false, backRight())).toBeNull();
  });
});
