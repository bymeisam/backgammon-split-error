import { describe, expect, it } from "vitest";
import { findMistakeIndex, isEditableTarget, moveTableAction, shouldIgnoreKey, stepIndex } from "./moveTableKeys";

describe("moveTableAction", () => {
  it("maps the arrows and vim keys the same on every move-table page", () => {
    for (const page of ["list", "replay"] as const) {
      expect(moveTableAction("ArrowDown", false, page)).toBe("next");
      expect(moveTableAction("j", false, page)).toBe("next");
      expect(moveTableAction("ArrowUp", false, page)).toBe("prev");
      expect(moveTableAction("k", false, page)).toBe("prev");
      expect(moveTableAction("ArrowLeft", false, page)).toBe("my");
      expect(moveTableAction("h", false, page)).toBe("my");
      expect(moveTableAction("ArrowRight", false, page)).toBe("best");
      expect(moveTableAction("l", false, page)).toBe("best");
    }
  });

  it("jumps between mistakes with Shift+↑/↓ and J/K on the replay only", () => {
    expect(moveTableAction("ArrowDown", true, "replay")).toBe("nextMistake");
    expect(moveTableAction("J", true, "replay")).toBe("nextMistake");
    expect(moveTableAction("ArrowUp", true, "replay")).toBe("prevMistake");
    expect(moveTableAction("K", true, "replay")).toBe("prevMistake");
    expect(moveTableAction("ArrowDown", true, "list")).toBeNull();
    expect(moveTableAction("J", true, "list")).toBeNull();
    expect(moveTableAction("ArrowUp", true, "list")).toBeNull();
    expect(moveTableAction("K", true, "list")).toBeNull();
  });

  it("leaves other keys (and shifted ←/→, H/L) alone", () => {
    for (const page of ["list", "replay"] as const) {
      expect(moveTableAction("ArrowLeft", true, page)).toBeNull();
      expect(moveTableAction("ArrowRight", true, page)).toBeNull();
      expect(moveTableAction("H", true, page)).toBeNull();
      expect(moveTableAction("L", true, page)).toBeNull();
      expect(moveTableAction("g", false, page)).toBeNull();
      expect(moveTableAction("Enter", false, page)).toBeNull();
      expect(moveTableAction(" ", false, page)).toBeNull();
      expect(moveTableAction("?", true, page)).toBeNull();
    }
  });
});

describe("isEditableTarget / shouldIgnoreKey", () => {
  const plain = { metaKey: false, ctrlKey: false, altKey: false };
  const body = { tagName: "BODY" };

  it("ignores keys typed into a text field, textarea, select or contenteditable", () => {
    expect(isEditableTarget({ tagName: "TEXTAREA" })).toBe(true);
    expect(isEditableTarget({ tagName: "SELECT" })).toBe(true);
    expect(isEditableTarget({ tagName: "INPUT", type: "text" })).toBe(true);
    expect(isEditableTarget({ tagName: "INPUT", type: "search" })).toBe(true);
    expect(isEditableTarget({ tagName: "INPUT" })).toBe(true);
    expect(isEditableTarget({ tagName: "DIV", isContentEditable: true })).toBe(true);
    expect(shouldIgnoreKey({ ...plain, target: { tagName: "TEXTAREA" } }, false)).toBe(true);
  });

  it("doesn't treat a checkbox, a button, a row or the page as typing", () => {
    expect(isEditableTarget({ tagName: "INPUT", type: "checkbox" })).toBe(false);
    expect(isEditableTarget({ tagName: "BUTTON" })).toBe(false);
    expect(isEditableTarget({ tagName: "TR" })).toBe(false);
    expect(isEditableTarget(body)).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
    expect(shouldIgnoreKey({ ...plain, target: body }, false)).toBe(false);
  });

  it("ignores Cmd, Ctrl and Alt, but not Shift", () => {
    expect(shouldIgnoreKey({ ...plain, metaKey: true, target: body }, false)).toBe(true);
    expect(shouldIgnoreKey({ ...plain, ctrlKey: true, target: body }, false)).toBe(true);
    expect(shouldIgnoreKey({ ...plain, altKey: true, target: body }, false)).toBe(true);
  });

  it("ignores keys while a dialog is open, during IME composition, or once handled", () => {
    expect(shouldIgnoreKey({ ...plain, target: body }, true)).toBe(true);
    expect(shouldIgnoreKey({ ...plain, target: body, isComposing: true }, false)).toBe(true);
    expect(shouldIgnoreKey({ ...plain, target: body, defaultPrevented: true }, false)).toBe(true);
  });
});

describe("stepIndex", () => {
  it("steps within the list and stops at both ends", () => {
    expect(stepIndex(0, 3, 1)).toBe(1);
    expect(stepIndex(1, 3, -1)).toBe(0);
    expect(stepIndex(2, 3, 1)).toBeNull();
    expect(stepIndex(0, 3, -1)).toBeNull();
  });

  it("goes to the first row when nothing is selected, and nowhere in an empty list", () => {
    expect(stepIndex(-1, 3, 1)).toBe(0);
    expect(stepIndex(-1, 3, -1)).toBe(0);
    expect(stepIndex(-1, 0, 1)).toBeNull();
  });
});

describe("findMistakeIndex (the replay's mistake jump)", () => {
  // true = a listed mistake (Error or Blunder).
  const rows = [false, true, false, false, true, false];
  const isMistake = (r: boolean) => r;

  it("finds the next and previous mistake, skipping the rows between", () => {
    expect(findMistakeIndex(rows, 0, 1, isMistake)).toBe(1);
    expect(findMistakeIndex(rows, 1, 1, isMistake)).toBe(4);
    expect(findMistakeIndex(rows, 5, -1, isMistake)).toBe(4);
    expect(findMistakeIndex(rows, 4, -1, isMistake)).toBe(1);
  });

  it("stops when there's no mistake that way", () => {
    expect(findMistakeIndex(rows, 4, 1, isMistake)).toBeNull();
    expect(findMistakeIndex(rows, 1, -1, isMistake)).toBeNull();
    expect(findMistakeIndex([false, false], 0, 1, isMistake)).toBeNull();
  });
});
