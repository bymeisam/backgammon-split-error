import { describe, expect, it } from "vitest";
import { pipsFor } from "@/app/components/match-analysis/Dice";

describe("pipsFor", () => {
  it("has value-many pips for 1 through 6", () => {
    for (let v = 1; v <= 6; v++) expect(pipsFor(v)).toHaveLength(v);
  });

  it("returns no pips for out-of-range values", () => {
    for (const v of [0, 7, -1, 2.5, NaN]) expect(pipsFor(v)).toEqual([]);
  });

  // Die values come from Galaxy's JSON unvalidated — the type says number,
  // the runtime doesn't guarantee it.
  it("doesn't resolve inherited object properties", () => {
    for (const name of ["toString", "constructor", "__proto__"]) {
      expect(pipsFor(name as unknown as number)).toEqual([]);
    }
  });
});
