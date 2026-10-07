import { describe, expect, it } from "vitest";
import { bulkConfirmText, planBulkAdd, type BulkScanRow } from "@/lib/review/bulk";

function scanner(rows: BulkScanRow[], ineligible: Set<number> = new Set()) {
  return {
    nextChunk: async (offset: number, size: number) => rows.slice(offset, offset + size),
    eligible: async (ids: number[]) => new Set(ids.filter((id) => !ineligible.has(id))),
  };
}

const rows = (n: number, inReview: Set<number> = new Set()) =>
  Array.from({ length: n }, (_, i) => ({ id: i + 1, inReview: inReview.has(i + 1) }));

describe("planBulkAdd", () => {
  it("takes the list's order, skipping cards and ineligible decisions", async () => {
    const plan = await planBulkAdd({ cap: 100, chunkSize: 3, ...scanner(rows(10, new Set([2, 5])), new Set([7])) });
    expect(plan).toEqual({ ids: [1, 3, 4, 6, 8, 9, 10], alreadyInReview: 2, ineligible: 1, capped: false });
  });

  it("stops at the cap; skipped counts cover the decisions walked; capped when more remain", async () => {
    const plan = await planBulkAdd({ cap: 3, chunkSize: 2, ...scanner(rows(10, new Set([2, 9])), new Set([4])) });
    expect(plan.ids).toEqual([1, 3, 5]);
    expect(plan.alreadyInReview).toBe(1);
    expect(plan.ineligible).toBe(1);
    expect(plan.capped).toBe(true);
  });

  it("not capped when exactly the cap is eligible", async () => {
    const plan = await planBulkAdd({ cap: 3, chunkSize: 2, ...scanner(rows(5, new Set([4, 5]))) });
    expect(plan).toEqual({ ids: [1, 2, 3], alreadyInReview: 0, ineligible: 0, capped: false });
  });

  it("an empty filter adds nothing", async () => {
    expect(await planBulkAdd({ cap: 100, chunkSize: 10, ...scanner([]) })).toEqual({
      ids: [],
      alreadyInReview: 0,
      ineligible: 0,
      capped: false,
    });
  });
});

describe("bulkConfirmText", () => {
  it("the spec's wording", () => {
    expect(bulkConfirmText({ added: 87, alreadyInReview: 13, ineligible: 0, capped: false }, 100)).toBe(
      "Add 87 decisions to review? 13 already in review, skipped."
    );
    expect(bulkConfirmText({ added: 100, alreadyInReview: 0, ineligible: 2, capped: true }, 100)).toBe(
      "Add 100 decisions to review? 2 can't be reviewed, skipped. Capped at 100; more decisions match this filter."
    );
    expect(bulkConfirmText({ added: 0, alreadyInReview: 5, ineligible: 0, capped: false }, 100)).toBe(
      "Nothing to add. 5 already in review, skipped."
    );
  });
});
