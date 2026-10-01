// Pure core of app/hooks/useTickSet.ts: which mistakes are "ticked" (count
// toward PR) on the match pages. Everything starts ticked, so the state is
// the set of *unticked* ids — empty by default, and an id the state has
// never seen is ticked. A Set, not a plain object keyed by id, so no id can
// collide with an inherited Object.prototype member.

export type TickSetAction =
  | { type: "toggle"; id: string }
  | { type: "setAll"; ids: string[]; ticked: boolean };

export function isTickedIn(unticked: ReadonlySet<string>, id: string): boolean {
  return !unticked.has(id);
}

export function tickSetReducer(
  unticked: ReadonlySet<string>,
  action: TickSetAction
): ReadonlySet<string> {
  const next = new Set(unticked);
  switch (action.type) {
    case "toggle":
      if (next.has(action.id)) next.delete(action.id);
      else next.add(action.id);
      return next;
    case "setAll":
      for (const id of action.ids) {
        if (action.ticked) next.delete(id);
        else next.add(id);
      }
      return next;
  }
}
