// Pure core of the list + single-detail selection pattern shared by
// MistakesSection, DecisionListWithDetail and GameReplay. The React side
// is a thin useReducer wrapper (app/hooks/useListSelection.ts), so all of
// the actual behavior lives here and is unit-testable without a DOM.

export type MoveTab = "my" | "best";

// The selected item, falling back to the first item when nothing is
// selected yet or the selected id is no longer in the list (e.g. after a
// filter change) — null only for an empty list.
export function resolveSelected<T, K>(
  list: readonly T[],
  id: K | null,
  getId: (item: T) => K
): T | null {
  const match = id === null ? undefined : list.find((item) => getId(item) === id);
  return match ?? list[0] ?? null;
}

export interface ListSelectionState<K> {
  selectedKey: K;
  moveTab: MoveTab;
}

export type ListSelectionAction<K> =
  | { type: "selectRow"; key: K; tab?: MoveTab }
  | { type: "setMoveTab"; tab: MoveTab };

// Selecting a row always resets the tab (to "my" unless one is given) —
// clicking a row's best-move label selects that row *and* shows its best
// move in one step; clicking the row itself starts on "my".
export function listSelectionReducer<K>(
  state: ListSelectionState<K>,
  action: ListSelectionAction<K>
): ListSelectionState<K> {
  switch (action.type) {
    case "selectRow":
      return { selectedKey: action.key, moveTab: action.tab ?? "my" };
    case "setMoveTab":
      return { ...state, moveTab: action.tab };
  }
}
