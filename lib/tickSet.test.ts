import { describe, expect, it } from "vitest";
import { isTickedIn, tickSetReducer } from "@/lib/tickSet";

const none = new Set<string>();

describe("tickSetReducer", () => {
  it("treats every id as ticked by default", () => {
    expect(isTickedIn(none, "1:5")).toBe(true);
  });

  it("toggles an id off and back on", () => {
    const off = tickSetReducer(none, { type: "toggle", id: "a" });
    expect(isTickedIn(off, "a")).toBe(false);
    expect(isTickedIn(off, "b")).toBe(true);
    expect(isTickedIn(tickSetReducer(off, { type: "toggle", id: "a" }), "a")).toBe(true);
  });

  it("sets a group of ids at once without touching others", () => {
    const off = tickSetReducer(none, { type: "setAll", ids: ["a", "b"], ticked: false });
    expect([isTickedIn(off, "a"), isTickedIn(off, "b"), isTickedIn(off, "c")]).toEqual([false, false, true]);
    const on = tickSetReducer(off, { type: "setAll", ids: ["a"], ticked: true });
    expect([isTickedIn(on, "a"), isTickedIn(on, "b")]).toEqual([true, false]);
  });

  it("is idempotent for setAll", () => {
    const once = tickSetReducer(none, { type: "setAll", ids: ["a"], ticked: false });
    const twice = tickSetReducer(once, { type: "setAll", ids: ["a"], ticked: false });
    expect([...twice]).toEqual([...once]);
  });

  it("doesn't mutate the previous state", () => {
    const prev = new Set(["a"]);
    tickSetReducer(prev, { type: "toggle", id: "b" });
    tickSetReducer(prev, { type: "setAll", ids: ["a"], ticked: true });
    expect([...prev]).toEqual(["a"]);
  });

  // The old Record<string, boolean> version read ticked[id] — ids are
  // built from Galaxy event data, so the state shouldn't care what they are.
  it("handles ids named like Object.prototype members", () => {
    for (const id of ["constructor", "toString", "__proto__"]) {
      expect(isTickedIn(none, id)).toBe(true);
      expect(isTickedIn(tickSetReducer(none, { type: "toggle", id }), id)).toBe(false);
    }
  });
});
