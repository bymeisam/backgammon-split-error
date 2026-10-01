import { describe, expect, it } from "vitest";
import {
  listSelectionReducer,
  resolveSelected,
  type ListSelectionState,
} from "@/lib/listSelection";

const items = [{ id: "a" }, { id: "b" }, { id: "c" }];
const getId = (item: { id: string }) => item.id;

describe("resolveSelected", () => {
  it("returns the item matching the selected id", () => {
    expect(resolveSelected(items, "b", getId)).toBe(items[1]);
  });

  it("falls back to the first item when nothing is selected yet", () => {
    expect(resolveSelected(items, null, getId)).toBe(items[0]);
  });

  it("falls back to the first item when the selected id is no longer listed", () => {
    expect(resolveSelected(items, "gone", getId)).toBe(items[0]);
  });

  it("returns null for an empty list, selected id or not", () => {
    expect(resolveSelected([], null, getId)).toBeNull();
    expect(resolveSelected([], "a", getId)).toBeNull();
  });

  it("works with a nested id accessor", () => {
    const wrapped = items.map((decision) => ({ decision }));
    expect(resolveSelected(wrapped, "c", (i) => i.decision.id)).toBe(wrapped[2]);
  });
});

describe("listSelectionReducer", () => {
  const initial: ListSelectionState<string | null> = { selectedKey: null, moveTab: "my" };

  it("selects a row and defaults the tab to my", () => {
    const state = { selectedKey: "a", moveTab: "best" as const };
    expect(listSelectionReducer(state, { type: "selectRow", key: "b" })).toEqual({
      selectedKey: "b",
      moveTab: "my",
    });
  });

  it("selects a row with an explicit tab in one step", () => {
    expect(listSelectionReducer(initial, { type: "selectRow", key: "b", tab: "best" })).toEqual({
      selectedKey: "b",
      moveTab: "best",
    });
  });

  it("re-selecting the current row still resets the tab", () => {
    const state = { selectedKey: "a", moveTab: "best" as const };
    expect(listSelectionReducer(state, { type: "selectRow", key: "a" }).moveTab).toBe("my");
  });

  it("switches tab without changing the selection", () => {
    const state = { selectedKey: "a", moveTab: "my" as const };
    expect(listSelectionReducer(state, { type: "setMoveTab", tab: "best" })).toEqual({
      selectedKey: "a",
      moveTab: "best",
    });
  });

  it("works with numeric (index) keys, including 0", () => {
    const state: ListSelectionState<number> = { selectedKey: 5, moveTab: "best" };
    expect(listSelectionReducer(state, { type: "selectRow", key: 0 })).toEqual({
      selectedKey: 0,
      moveTab: "my",
    });
  });

  it("doesn't mutate the previous state", () => {
    const state = { selectedKey: "a", moveTab: "my" as const };
    listSelectionReducer(state, { type: "setMoveTab", tab: "best" });
    expect(state).toEqual({ selectedKey: "a", moveTab: "my" });
  });
});
