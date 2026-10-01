import { useCallback, useReducer } from "react";
import { isTickedIn, tickSetReducer } from "@/lib/tickSet";

export interface TickSet {
  isTicked: (id: string) => boolean;
  toggle: (id: string) => void;
  setAll: (ids: string[], ticked: boolean) => void;
}

// Per-mistake "counts toward PR" checkboxes. Logic lives in lib/tickSet.ts.
export function useTickSet(): TickSet {
  const [unticked, dispatch] = useReducer(tickSetReducer, new Set<string>());

  const isTicked = useCallback((id: string) => isTickedIn(unticked, id), [unticked]);
  const toggle = useCallback((id: string) => dispatch({ type: "toggle", id }), []);
  const setAll = useCallback(
    (ids: string[], ticked: boolean) => dispatch({ type: "setAll", ids, ticked }),
    []
  );

  return { isTicked, toggle, setAll };
}
