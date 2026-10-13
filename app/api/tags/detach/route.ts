import { NextResponse } from "next/server";
import { prismaApp } from "@/lib/prisma";
import { isAppWriteEnabled } from "@/lib/appWriteGate";
import { positiveId, readJsonObject } from "@/lib/review/requests";
import { requireOwnerApi } from "@/lib/app-auth";

export const dynamic = "force-dynamic";

// POST /api/tags/detach   body: { "decisionId": number, "tagId": number }
//
// Removes a tag from a decision. The tag itself stays (it keeps feeding the
// autocomplete). Removing a tag the decision doesn't have is a no-op.
// 400 bad input.
//
// App write client (prismaApp). Owner only; 403 unless isAppWriteEnabled().
export async function POST(req: Request) {
  const denied = await requireOwnerApi();
  if (denied) return denied;
  if (!isAppWriteEnabled()) return NextResponse.json({ error: "Writes are disabled." }, { status: 403 });
  const body = await readJsonObject(req);
  const decisionId = positiveId(body?.decisionId);
  const tagId = positiveId(body?.tagId);
  if (decisionId === null || tagId === null) {
    return NextResponse.json(
      { error: "Body must be JSON: { \"decisionId\": positive integer, \"tagId\": positive integer }." },
      { status: 400 }
    );
  }
  const removed = await prismaApp.decisionTag.deleteMany({ where: { decisionId, tagId } });
  return NextResponse.json({ removed: removed.count });
}
