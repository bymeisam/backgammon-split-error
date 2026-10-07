import { NextResponse, type NextRequest } from "next/server";
import { prismaReadOnly } from "@/lib/prisma";
import { NEW_CARDS_PER_DAY, REVIEW_BATCH_SIZE, REVIEWS_PER_DAY } from "@/lib/settings";
import { reviewDecisionWhere, reviewFiltersFrom } from "@/lib/review/filters";
import { dailyProgress, parseIdList, planQueue, startOfLocalDay, startOfNextLocalDay } from "@/lib/review/queue";
import { buildCardPayload, REVIEW_CARD_SELECT } from "@/lib/review/cardPayload";
import type { ReviewCardPayload, ReviewQueueResponse } from "@/lib/review/types";

export const dynamic = "force-dynamic";

// GET /api/review/queue?tag=&phase=&category=&severity=&exclude=1,2,3
//
// The next batch of due cards for a /review session (lib/review/queue.ts's
// planQueue: learning cards, then review cards, then new cards, within
// today's limits), up to REVIEW_BATCH_SIZE, plus the due counts. `exclude`
// is every card the session already holds or has answered. Read-only
// client: it only reads. Under /api/review/, so gated by proxy.ts like the
// writes — /review itself only runs a session with write mode on.
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const filters = reviewFiltersFrom((k) => sp.get(k) ?? undefined);
  const exclude = new Set(parseIdList(sp.get("exclude")));
  const now = new Date();

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

  const plan = planQueue({
    candidates,
    now,
    progress: dailyProgress(todayLogs),
    newPerDay: NEW_CARDS_PER_DAY,
    reviewsPerDay: REVIEWS_PER_DAY,
    exclude,
    batchSize: REVIEW_BATCH_SIZE,
  });

  const rows =
    plan.batchIds.length === 0
      ? []
      : await prismaReadOnly.reviewCard.findMany({
          where: { id: { in: plan.batchIds } },
          select: REVIEW_CARD_SELECT,
        });
  const byId = new Map(rows.map((r) => [r.id, r]));
  const cards: ReviewCardPayload[] = [];
  for (const id of plan.batchIds) {
    const row = byId.get(id);
    const payload = row ? buildCardPayload(row) : null;
    if (payload) cards.push(payload);
  }

  const body: ReviewQueueResponse = { cards, due: plan.due, batchNew: plan.batchNew };
  return NextResponse.json(body);
}
