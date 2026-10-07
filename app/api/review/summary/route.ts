import { NextResponse, type NextRequest } from "next/server";
import { prismaReadOnly } from "@/lib/prisma";
import { NEW_CARDS_PER_DAY, REVIEWS_PER_DAY } from "@/lib/settings";
import { reviewDecisionWhere, reviewFiltersFrom } from "@/lib/review/filters";
import { dailyProgress, planQueue, startOfLocalDay, startOfNextLocalDay } from "@/lib/review/queue";
import type { ReviewSummaryResponse } from "@/lib/review/types";

export const dynamic = "force-dynamic";

// GET /api/review/summary?tag=&phase=&category=&severity=
//
// For the end-of-session summary: when the next card (in this filter) is
// due. That's the earliest unsuspended card due after now, or the next
// local midnight when cards are already due but held back by today's
// limits. Read-only client; gated by proxy.ts (/api/review/:path*).
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const decision = reviewDecisionWhere(reviewFiltersFrom((k) => sp.get(k) ?? undefined));
  const now = new Date();
  const tomorrow = startOfNextLocalDay(now);

  const [next, dueNow, todayLogs] = await Promise.all([
    prismaReadOnly.reviewCard.findFirst({
      where: { suspended: false, due: { gt: now }, decision },
      orderBy: { due: "asc" },
      select: { due: true },
    }),
    prismaReadOnly.reviewCard.findMany({
      where: { suspended: false, due: { lt: tomorrow }, decision },
      select: { id: true, state: true, due: true },
    }),
    prismaReadOnly.reviewLog.findMany({
      where: { reviewedAt: { gte: startOfLocalDay(now) } },
      select: { cardId: true, reviewedAt: true, stateBefore: true },
    }),
  ]);

  const plan = planQueue({
    candidates: dueNow,
    now,
    progress: dailyProgress(todayLogs),
    newPerDay: NEW_CARDS_PER_DAY,
    reviewsPerDay: REVIEWS_PER_DAY,
    exclude: new Set(),
    batchSize: 1,
  });
  // Cards due by today's rules but over the limits (or due later today)
  // come back tomorrow at the latest.
  const heldBack = dueNow.length > plan.due.new + plan.due.review;
  let nextDue = next?.due ?? null;
  if (heldBack && (nextDue === null || tomorrow < nextDue)) nextDue = tomorrow;
  if (plan.batchIds.length > 0) nextDue = now;

  const body: ReviewSummaryResponse = { nextDue: nextDue ? nextDue.toISOString() : null };
  return NextResponse.json(body);
}
