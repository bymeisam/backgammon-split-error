import { NextResponse } from "next/server";
import { prismaApp } from "@/lib/prisma";
import { normalizeNote, parseDecisionId } from "@/lib/decisionNotes";
import { requireOwnerApi } from "@/lib/app-auth";
import { isAppWriteEnabled } from "@/lib/appWriteGate";

export const dynamic = "force-dynamic";

// POST /api/decisions/[id]/note   body: { "note": string }
//
// The one write path for decision notes: create, update and clear, keyed by
// the real Decision.id. An empty or whitespace-only note deletes the row.
// App write client (`prismaApp`, DATABASE_URL_APP or locally DATABASE_URL).
//
// Owner only, and only with app writes on (isAppWriteEnabled(),
// lib/appWriteGate.ts, the same gate as the forum and review writes): 403
// when off.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireOwnerApi();
  if (denied) return denied;
  if (!isAppWriteEnabled()) return NextResponse.json({ error: "Writes are disabled." }, { status: 403 });
  const { id: idParam } = await params;
  const decisionId = parseDecisionId(idParam);
  if (decisionId === null) {
    return NextResponse.json({ error: "Decision id must be a positive integer." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON: { \"note\": string }." }, { status: 400 });
  }
  const normalized = normalizeNote((body as { note?: unknown } | null)?.note);
  if (!normalized.ok) {
    return NextResponse.json({ error: normalized.error }, { status: 400 });
  }

  const decision = await prismaApp.decision.findUnique({ where: { id: decisionId }, select: { id: true } });
  if (!decision) {
    return NextResponse.json({ error: `Decision ${decisionId} doesn't exist.` }, { status: 404 });
  }

  if (normalized.note === null) {
    await prismaApp.decisionNote.deleteMany({ where: { decisionId } });
    return NextResponse.json({ note: null, updatedAt: null });
  }

  const saved = await prismaApp.decisionNote.upsert({
    where: { decisionId },
    create: { decisionId, note: normalized.note },
    update: { note: normalized.note },
    select: { note: true, updatedAt: true },
  });
  return NextResponse.json({ note: saved.note, updatedAt: saved.updatedAt.toISOString() });
}
