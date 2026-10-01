import { useCallback, useReducer } from "react";
import { listSelectionReducer, type MoveTab } from "@/lib/listSelection";

// Selected row + my/best move tab for a list + single-detail view. `K` is
// whatever identifies a row for the caller — a decision id (string | null,
// null meaning "nothing picked yet") or a list index (number).
export function useListSelection<K>(initialKey: K) {
  const [state, dispatch] = useReducer(listSelectionReducer<K>, {
    selectedKey: initialKey,
    moveTab: "my",
  });

  const selectRow = useCallback(
    (key: K, tab: MoveTab = "my") => dispatch({ type: "selectRow", key, tab }),
    []
  );
  const setMoveTab = useCallback((tab: MoveTab) => dispatch({ type: "setMoveTab", tab }), []);

  return { selectedKey: state.selectedKey, moveTab: state.moveTab, selectRow, setMoveTab };
}
