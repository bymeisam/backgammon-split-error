// The review queue's reads: today's candidate cards (unsuspended, due
// before the next local midnight, in the filter) and today's answers, fed
// to lib/review/queue.ts's planQueue. One copy, shared by
// /api/review/queue (the /review session's batches and its "N new · N
// review" header), the dashboard's due widget and the navbar's due badge
// (both the sum of the split), so all three show the same counts.
// Read-only client.
import { prismaReadOnly } from "@/lib/prisma";
import { NEW_CARDS_PER_DAY, REVIEWS_PER_DAY } from "@/lib/settings";
import { reviewDecisionWhere, reviewFiltersFrom, type ReviewFilters } from "@/lib/review/filters";
import { dailyProgress, planQueue, startOfLocalDay, startOfNextLocalDay, type QueuePlan } from "@/lib/review/queue";

export async function loadQueuePlan(opts: {
  filters: ReviewFilters;
  exclude: Set<number>;
  batchSize: number;
  now: Date;
}): Promise<QueuePlan> {
  const { filters, exclude, batchSize, now } = opts;
  const [candidates, todayLogs] = await Promise.all([
    prismaReadOnly.reviewCard.findMany({
      where: { suspended: false, due: { lt: startOfNextLocalDay(now) }, decision: reviewDecisionWhere(filters) },
      orderBy: [{ due: "asc" }, { id: "asc" }],
      select: { id: true, state: true, due: true },
    }),
    prismaReadOnly.reviewLog.findMany({
      where: { reviewedAt: { gte: startOfLocalDay(now) } },
      select: { cardId: true, reviewedAt: true, stateBefore: true },
    }),
  ]);

  return planQueue({
    candidates,
    now,
    progress: dailyProgress(todayLogs),
    newPerDay: NEW_CARDS_PER_DAY,
    reviewsPerDay: REVIEWS_PER_DAY,
    exclude,
    batchSize,
  });
}

// The /review header's "N new · N review" for an unfiltered session, before
// any card is loaded: the dashboard's due widget and the navbar's badge.
export async function dueSplit(now: Date): Promise<QueuePlan["due"]> {
  const plan = await loadQueuePlan({ filters: reviewFiltersFrom(() => undefined), exclude: new Set(), batchSize: 0, now });
  return plan.due;
}
