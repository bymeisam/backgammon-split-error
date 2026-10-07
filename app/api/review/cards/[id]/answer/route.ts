import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ELIGIBILITY_SELECT } from "@/lib/review/db";
import { reviewEligibility } from "@/lib/review/eligibility";
import { scheduleReview, scheduleToJson, RATING_VALUE, type CardSchedule } from "@/lib/review/fsrs";
import { gradeAnswer } from "@/lib/review/options";
import { parseAnswerInput, positiveId, ratingFor, readJsonObject } from "@/lib/review/requests";
import type { ReviewAnswerResponse } from "@/lib/review/types";

export const dynamic = "force-dynamic";

// POST /api/review/cards/[id]/answer
//   body: { "chosen": optionKey, "rating"?: "hard"|"good"|"easy", "durationMs"?: number }
//
// Grades the answer on the server (lib/review/options.ts, from the
// decision's raw through the analysis dispatcher — the client's own grading
// is only for display), then, in ONE transaction, writes the ReviewLog row
// (with the card's FSRS state before) and the card's new FSRS schedule. A
// wrong answer is always rated Again; a right one needs hard/good/easy.
// 400 bad input or rating, 404 no such card, 409 suspended, 422 the
// decision can't be graded any more.
//
// Read-write client. Gated by proxy.ts (/api/review/:path*).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const cardId = positiveId((await params).id);
  if (cardId === null) return NextResponse.json({ error: "Card id must be a positive integer." }, { status: 400 });
  const body = await readJsonObject(req);
  if (!body) {
    return NextResponse.json({ error: "Body must be JSON: { \"chosen\": string, \"rating\"?: string }." }, { status: 400 });
  }
  const input = parseAnswerInput(body);
  if (!input.ok) return NextResponse.json({ error: input.error }, { status: 400 });

  const card = await prisma.reviewCard.findUnique({
    where: { id: cardId },
    select: {
      id: true,
      due: true,
      stability: true,
      difficulty: true,
      elapsedDays: true,
      scheduledDays: true,
      learningSteps: true,
      reps: true,
      lapses: true,
      state: true,
      lastReview: true,
      suspended: true,
      decision: { select: ELIGIBILITY_SELECT },
    },
  });
  if (!card) return NextResponse.json({ error: `Card ${cardId} doesn't exist.` }, { status: 404 });
  if (card.suspended) return NextResponse.json({ error: `Card ${cardId} is suspended.` }, { status: 409 });

  const d = card.decision;
  const eligibility = reviewEligibility({
    kind: d.kind,
    countAsDecision: d.countAsDecision,
    rawError: d.rawError,
    source: d.game.match.source,
    raw: d.raw,
  });
  if (!eligibility.eligible) {
    return NextResponse.json({ error: `Card ${cardId} can't be graded (${eligibility.reason}).` }, { status: 422 });
  }
  const grade = gradeAnswer(eligibility.analysis, input.chosen);
  if (!grade) {
    return NextResponse.json({ error: `"${input.chosen}" isn't one of this card's options.` }, { status: 400 });
  }
  const rating = ratingFor(grade.correct, input.rating);
  if (!rating.ok) return NextResponse.json({ error: rating.error }, { status: 400 });

  const now = new Date();
  const before: CardSchedule = {
    due: card.due,
    stability: card.stability,
    difficulty: card.difficulty,
    elapsedDays: card.elapsedDays,
    scheduledDays: card.scheduledDays,
    learningSteps: card.learningSteps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    lastReview: card.lastReview,
  };
  const after = scheduleReview(before, rating.rating, now);

  await prisma.$transaction([
    prisma.reviewLog.create({
      data: {
        cardId,
        rating: RATING_VALUE[rating.rating],
        correct: grade.correct,
        chosen: input.chosen,
        loss: grade.loss,
        stateBefore: scheduleToJson(before),
        reviewedAt: now,
        durationMs: input.durationMs,
      },
    }),
    prisma.reviewCard.update({ where: { id: cardId }, data: after }),
  ]);

  const response: ReviewAnswerResponse = {
    correct: grade.correct,
    rating: rating.rating,
    loss: grade.loss,
    due: after.due.toISOString(),
    state: after.state,
  };
  return NextResponse.json(response);
}
