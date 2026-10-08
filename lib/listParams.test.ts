import { ErrorSeverity } from "@/lib/generated/prisma/enums";
import { describe, expect, it } from "vitest";
import {
  buildQueryString,
  LISTED_KINDS,
  categoryFromParam,
  categoryLabel,
  categoryOptions,
  describeResultCount,
  filterSummary,
  severityOptions,
  severityParamLabel,
  lowercaseParam,
  pageHref,
  parseListParams,
  positiveIntParam,
  severityFromParam,
  stringParam,
  totalPagesFor,
} from "@/lib/listParams";

const OPTS = { defaultPageSize: 20 };

describe("stringParam / lowercaseParam / positiveIntParam", () => {
  it("treats a missing or repeated param as absent", () => {
    expect(stringParam({}, "a")).toBeUndefined();
    expect(stringParam({ a: ["x", "y"] }, "a")).toBeUndefined();
    expect(stringParam({ a: "x" }, "a")).toBe("x");
  });

  it("lowercases", () => {
    expect(lowercaseParam({ severity: "BLUNDER" }, "severity")).toBe("blunder");
    expect(lowercaseParam({}, "severity")).toBeUndefined();
  });

  it("accepts only positive integers", () => {
    expect(positiveIntParam({ n: "3" }, "n")).toBe(3);
    for (const bad of ["0", "-4", "2.5", "abc", ""]) {
      expect(positiveIntParam({ n: bad }, "n")).toBeUndefined();
    }
    expect(positiveIntParam({}, "n")).toBeUndefined();
  });
});

describe("parseListParams", () => {
  it("returns defaults for no params", () => {
    expect(parseListParams({}, OPTS)).toEqual({
      phase: undefined,
      severityParam: undefined,
      page: 1,
      pageSize: 20,
    });
  });

  it("reads phase, lowercased severity, page and an allowed page size", () => {
    expect(parseListParams({ phase: "ply_3", severity: "Error", page: "4", pageSize: "50" }, OPTS)).toEqual({
      phase: "ply_3",
      severityParam: "error",
      page: 4,
      pageSize: 50,
    });
  });

  it("accepts ?classification= as an alias only when ?phase= is absent", () => {
    expect(parseListParams({ classification: "race" }, OPTS).phase).toBe("race");
    expect(parseListParams({ phase: "ply_1", classification: "race" }, OPTS).phase).toBe("ply_1");
  });

  it("falls back to page 1 and the default size for invalid values", () => {
    const parsed = parseListParams({ page: "abc", pageSize: "7" }, { defaultPageSize: 10 });
    expect(parsed.page).toBe(1);
    expect(parsed.pageSize).toBe(10);
  });
});

describe("severityFromParam / categoryFromParam", () => {
  it("maps known lowercase values to the Prisma enum", () => {
    expect(severityFromParam("blunder")).toBe("BLUNDER");
    expect(severityFromParam("none")).toBe("NONE");
    expect(categoryFromParam("cube")).toBe("CUBE");
    expect(categoryFromParam("checker")).toBe("CHECKER");
  });

  it("resignation is not a category (resignations are never listed): no filter, i.e. checker + cube", () => {
    expect(categoryFromParam("resignation")).toBeUndefined();
    expect(LISTED_KINDS).toEqual(["CHECKER", "CUBE"]);
  });

  it("returns undefined (no filter) for unknown or absent values", () => {
    expect(severityFromParam("bogus")).toBeUndefined();
    expect(severityFromParam(undefined)).toBeUndefined();
    expect(categoryFromParam("BLUNDER")).toBeUndefined(); // callers lowercase first
  });

  // ?category=constructor used to hand Object.prototype.constructor to
  // Prisma's where clause and crash the list with PrismaClientValidationError.
  it("doesn't resolve inherited object properties from the URL", () => {
    for (const name of ["constructor", "tostring", "hasownproperty", "__proto__"]) {
      expect(severityFromParam(name)).toBeUndefined();
      expect(categoryFromParam(name)).toBeUndefined();
    }
  });
});

describe("buildQueryString / pageHref", () => {
  it("drops empty and undefined values, and returns '' when nothing is left", () => {
    expect(buildQueryString({ a: "1", b: undefined, c: "" })).toBe("?a=1");
    expect(buildQueryString({})).toBe("");
  });

  it("encodes values", () => {
    expect(buildQueryString({ phase: "a b&c" })).toBe("?phase=a+b%26c");
  });

  it("builds a page link carrying the filters, overriding any page already in them", () => {
    expect(pageHref("/mistakes", { severity: "error", pageSize: "20" }, 3)).toBe(
      "/mistakes?severity=error&pageSize=20&page=3"
    );
    expect(pageHref("/x", { page: "9" }, 2)).toBe("/x?page=2");
  });
});

describe("totalPagesFor", () => {
  it("rounds up, with at least one page", () => {
    expect(totalPagesFor(0, 10)).toBe(1);
    expect(totalPagesFor(10, 10)).toBe(1);
    expect(totalPagesFor(11, 10)).toBe(2);
  });
});

describe("describeResultCount", () => {
  it("makes an Error or Blunder severity the noun, lower-cased after the phase and category", () => {
    expect(describeResultCount(39028, { category: "checker", severity: ErrorSeverity.BLUNDER, noun: "decision" })).toBe(
      `${(39028).toLocaleString()} checker blunders`
    );
    expect(describeResultCount(1, { phase: "race", severity: ErrorSeverity.ERROR, noun: "decision" })).toBe(
      "1 race error"
    );
    expect(describeResultCount(12, { phase: "ply_3", category: "CUBE", noun: "decision" })).toBe(
      "12 2nd roll cube decisions"
    );
  });

  it("keeps Best and Good as adjectives, and repeated positions as the noun", () => {
    expect(describeResultCount(3, { severity: ErrorSeverity.DOUBTFUL, noun: "decision" })).toBe("3 good decisions");
    expect(describeResultCount(5, { severity: ErrorSeverity.BLUNDER, noun: "repeated position" })).toBe(
      "5 blunder repeated positions"
    );
  });
});

describe("categoryLabel / categoryOptions", () => {
  it("shows Checker and Cube, submitting lowercase", () => {
    expect(categoryLabel("CHECKER")).toBe("Checker");
    expect(categoryLabel("cube")).toBe("Cube");
    expect(categoryLabel("other")).toBe("other");
    expect(categoryOptions(["CHECKER", "CUBE"])).toEqual([
      { value: "checker", label: "Checker" },
      { value: "cube", label: "Cube" },
    ]);
  });
});

describe("filterSummary", () => {
  it("joins each value, or its unset wording", () => {
    expect(filterSummary([[undefined, "Any phase"], ["Blunder", "All severities"]])).toBe("Any phase · Blunder");
  });
});

describe("severityOptions / severityParamLabel — Galaxy's names, same values", () => {
  it("submits the lowercase enum value, shows Galaxy's name, in Galaxy's order", () => {
    expect(severityOptions(["BLUNDER", "DOUBTFUL", "ERROR", "NONE"])).toEqual([
      { value: "none", label: "Best" },
      { value: "doubtful", label: "Good" },
      { value: "error", label: "Error" },
      { value: "blunder", label: "Blunder" },
    ]);
  });

  it("names a ?severity= value, passing an unknown one through", () => {
    expect(severityParamLabel("doubtful")).toBe("Good");
    expect(severityParamLabel("none")).toBe("Best");
    expect(severityParamLabel("bogus")).toBe("bogus");
    expect(severityParamLabel(undefined)).toBeUndefined();
  });
});
