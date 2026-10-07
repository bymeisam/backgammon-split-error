// "Add all to review" (/mistakes): which decisions of the current filter
// get cards. Pure, given a scan callback, so it's unit-tested without a DB;
// app/api/review/bulk/route.ts supplies the Prisma reads.
//
// Walks the filter in the list's own order, skipping decisions that are
// already cards and ineligible ones (lib/review/eligibility.ts), until it
// has `cap` decisions. Skipped counts are of the decisions walked up to
// that point. `capped` says whether at least one more eligible decision
// lies beyond the cap.
export interface BulkScanRow {
  id: number;
  inReview: boolean;
}

export interface BulkPlan {
  ids: number[];
  alreadyInReview: number;
  ineligible: number;
  capped: boolean;
}

// `nextChunk(offset)` returns the filter's rows from `offset` in list order
// (empty when done); `eligible(ids)` the subset of ids that are eligible.
export async function planBulkAdd(opts: {
  cap: number;
  chunkSize: number;
  nextChunk: (offset: number, size: number) => Promise<BulkScanRow[]>;
  eligible: (ids: number[]) => Promise<Set<number>>;
}): Promise<BulkPlan> {
  const ids: number[] = [];
  let alreadyInReview = 0;
  let ineligible = 0;
  let capped = false;
  let offset = 0;

  for (;;) {
    const rows = await opts.nextChunk(offset, opts.chunkSize);
    if (rows.length === 0) break;
    offset += rows.length;
    const candidates = rows.filter((r) => !r.inReview).map((r) => r.id);
    const ok = candidates.length > 0 ? await opts.eligible(candidates) : new Set<number>();

    for (const row of rows) {
      const isOk = !row.inReview && ok.has(row.id);
      if (ids.length >= opts.cap) {
        if (isOk) {
          capped = true;
          break;
        }
        continue;
      }
      if (row.inReview) alreadyInReview++;
      else if (isOk) ids.push(row.id);
      else ineligible++;
    }
    if (capped || rows.length < opts.chunkSize) break;
  }
  return { ids, alreadyInReview, ineligible, capped };
}

// The confirmation text: "Add 87 decisions to review? 13 already in review,
// skipped."
export function bulkConfirmText(plan: { added: number; alreadyInReview: number; ineligible: number; capped: boolean }, cap: number): string {
  const head =
    plan.added === 0
      ? "Nothing to add."
      : `Add ${plan.added} decision${plan.added === 1 ? "" : "s"} to review?`;
  const skipped: string[] = [];
  if (plan.alreadyInReview > 0) skipped.push(`${plan.alreadyInReview} already in review`);
  if (plan.ineligible > 0) skipped.push(`${plan.ineligible} can't be reviewed`);
  const parts = [head];
  if (skipped.length > 0) parts.push(`${skipped.join(", ")}, skipped.`);
  if (plan.capped) parts.push(`Capped at ${cap}; more decisions match this filter.`);
  return parts.join(" ");
}
