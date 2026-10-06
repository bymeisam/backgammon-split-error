import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeNote, parseDecisionId } from "@/lib/decisionNotes";

export const dynamic = "force-dynamic";

// POST /api/decisions/[id]/note   body: { "note": string }
//
// The one write path for decision notes: create, update and clear, keyed by
// the real Decision.id. An empty or whitespace-only note deletes the row.
// Read-write client (`prisma`, DATABASE_URL) — writes go to whichever DB
// DATABASE_URL points at.
//
// Gated by proxy.ts's matcher (/api/decisions/:path*): it 404s before this
// handler ever runs unless isGalaxyEnabled() — same single choke point as
// every other write route, so it's never reachable with write mode off.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
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

  const decision = await prisma.decision.findUnique({ where: { id: decisionId }, select: { id: true } });
  if (!decision) {
    return NextResponse.json({ error: `Decision ${decisionId} doesn't exist.` }, { status: 404 });
  }

  if (normalized.note === null) {
    await prisma.decisionNote.deleteMany({ where: { decisionId } });
    return NextResponse.json({ note: null, updatedAt: null });
  }

  const saved = await prisma.decisionNote.upsert({
    where: { decisionId },
    create: { decisionId, note: normalized.note },
    update: { note: normalized.note },
    select: { note: true, updatedAt: true },
  });
  return NextResponse.json({ note: saved.note, updatedAt: saved.updatedAt.toISOString() });
}
