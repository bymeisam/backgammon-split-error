// Unsuspended review cards due today: the (suspended, due) index, before
// today's daily limits (the /review header, the navbar badge and the
// dashboard's big number show the limited counts, lib/review/queuePlan.ts).
// The dashboard uses it for "N more held back by today's limits". Write mode
// only: callers check isGalaxyEnabled() first, so the read-only site never
// queries the review tables from the shell.
import { prismaReadOnly as prisma } from "@/lib/prisma";
import { startOfNextLocalDay } from "@/lib/review/queue";

export function countDueCards(now: Date): Promise<number> {
  return prisma.reviewCard.count({
    where: { suspended: false, due: { lt: startOfNextLocalDay(now) } },
  });
}
