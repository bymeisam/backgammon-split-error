import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ELIGIBILITY_SELECT, isUniqueViolation } from "@/lib/review/db";
import { reviewEligibility } from "@/lib/review/eligibility";
import { newSchedule } from "@/lib/review/fsrs";
import { positiveId, readJsonObject } from "@/lib/review/requests";

export const dynamic = "force-dynamic";

// POST /api/review/cards   body: { "decisionId": number }
//
// Adds one decision to review: creates its ReviewCard with a fresh FSRS
// schedule (due now). Read-write client (`prisma`). 400 bad input, 404 no
// such decision, 409 already in review, 422 not eligible
// (lib/review/eligibility.ts).
//
// Gated by proxy.ts's matcher (/api/review/:path*): 404 unless
// isGalaxyEnabled(), like every other write route.
export async function POST(req: Request) {
  const body = await readJsonObject(req);
  const decisionId = positiveId(body?.decisionId);
  if (decisionId === null) {
    return NextResponse.json({ error: "Body must be JSON: { \"decisionId\": positive integer }." }, { status: 400 });
  }

  const decision = await prisma.decision.findUnique({
    where: { id: decisionId },
    select: { ...ELIGIBILITY_SELECT, reviewCard: { select: { id: true } } },
  });
  if (!decision) {
    return NextResponse.json({ error: `Decision ${decisionId} doesn't exist.` }, { status: 404 });
  }
  if (decision.reviewCard) {
    return NextResponse.json(
      { error: `Decision ${decisionId} is already in review.`, cardId: decision.reviewCard.id },
      { status: 409 }
    );
  }
  const eligibility = reviewEligibility({
    kind: decision.kind,
    countAsDecision: decision.countAsDecision,
    rawError: decision.rawError,
    source: decision.game.match.source,
    raw: decision.raw,
  });
  if (!eligibility.eligible) {
    return NextResponse.json(
      { error: `Decision ${decisionId} can't be reviewed (${eligibility.reason}).` },
      { status: 422 }
    );
  }

  try {
    const card = await prisma.reviewCard.create({
      data: { decisionId, ...newSchedule(new Date()) },
      select: { id: true, due: true, suspended: true },
    });
    return NextResponse.json(
      { cardId: card.id, due: card.due.toISOString(), suspended: card.suspended },
      { status: 201 }
    );
  } catch (err) {
    if (isUniqueViolation(err)) {
      return NextResponse.json({ error: `Decision ${decisionId} is already in review.` }, { status: 409 });
    }
    throw err;
  }
}
