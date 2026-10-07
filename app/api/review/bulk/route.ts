import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mistakesWhere } from "@/lib/listParams";
import { BULK_ADD_CAP } from "@/lib/settings";
import { ELIGIBILITY_SELECT } from "@/lib/review/db";
import { isReviewEligible } from "@/lib/review/eligibility";
import { newSchedule } from "@/lib/review/fsrs";
import { planBulkAdd } from "@/lib/review/bulk";
import { readJsonObject } from "@/lib/review/requests";
import type { BulkAddResponse } from "@/lib/review/types";

export const dynamic = "force-dynamic";

const CHUNK = 500;

function optionalString(v: unknown): string | undefined | null {
  if (v === undefined || v === null || v === "") return undefined;
  return typeof v === "string" ? v : null;
}

// POST /api/review/bulk
//   body: { "phase"?: string, "category"?: string, "severity"?: string, "dryRun": boolean }
//
// "Add all to review" on /mistakes: the same filter as the list
// (lib/listParams.ts's mistakesWhere), in the list's order (eventId desc,
// id desc for ties), up to BULK_ADD_CAP decisions, skipping ones already in
// review and ineligible ones (lib/review/bulk.ts). dryRun: true only counts
// (the confirmation); dryRun: false does the same walk and creates the cards
// in ONE transaction. At least one filter is required, as on /mistakes.
//
// Read-write client (the walk runs inside the transaction too, so the count
// and the insert agree). Gated by proxy.ts (/api/review/:path*).
export async function POST(req: Request) {
  const body = await readJsonObject(req);
  const phase = optionalString(body?.phase);
  const category = optionalString(body?.category);
  const severity = optionalString(body?.severity);
  if (!body || phase === null || category === null || severity === null || typeof body.dryRun !== "boolean") {
    return NextResponse.json(
      { error: "Body must be JSON: { phase?: string, category?: string, severity?: string, dryRun: boolean }." },
      { status: 400 }
    );
  }
  if (!phase && !category && !severity) {
    return NextResponse.json({ error: "Pick at least one filter (phase, category or severity)." }, { status: 400 });
  }
  const dryRun = body.dryRun;
  const where = mistakesWhere({
    phase,
    categoryParam: category?.toLowerCase(),
    severityParam: severity?.toLowerCase(),
  });

  const result = await prisma.$transaction(
    async (tx) => {
      const plan = await planBulkAdd({
        cap: BULK_ADD_CAP,
        chunkSize: CHUNK,
        nextChunk: async (offset, size) => {
          const rows = await tx.decision.findMany({
            where,
            orderBy: [{ eventId: "desc" }, { id: "desc" }],
            skip: offset,
            take: size,
            select: { id: true, reviewCard: { select: { id: true } } },
          });
          return rows.map((r) => ({ id: r.id, inReview: r.reviewCard !== null }));
        },
        eligible: async (ids) => {
          const rows = await tx.decision.findMany({ where: { id: { in: ids } }, select: ELIGIBILITY_SELECT });
          return new Set(
            rows
              .filter((r) =>
                isReviewEligible({
                  kind: r.kind,
                  countAsDecision: r.countAsDecision,
                  rawError: r.rawError,
                  source: r.game.match.source,
                  raw: r.raw,
                })
              )
              .map((r) => r.id)
          );
        },
      });
      if (!dryRun && plan.ids.length > 0) {
        const schedule = newSchedule(new Date());
        await tx.reviewCard.createMany({
          data: plan.ids.map((decisionId) => ({ decisionId, ...schedule })),
          skipDuplicates: true,
        });
      }
      return plan;
    },
    { timeout: 120_000, maxWait: 10_000 }
  );

  const response: BulkAddResponse = {
    dryRun,
    added: result.ids.length,
    alreadyInReview: result.alreadyInReview,
    ineligible: result.ineligible,
    capped: result.capped,
  };
  return NextResponse.json(response, { status: dryRun ? 200 : 201 });
}
