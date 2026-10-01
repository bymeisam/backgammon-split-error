import { NextRequest, NextResponse } from "next/server";
import { ingestMatch, parseMatchIndexData } from "@/lib/ingest";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  const { matchId: matchIdParam } = await params;
  const matchId = Number(matchIdParam);

  if (!Number.isInteger(matchId)) {
    return jsonError("Invalid matchId.", 400);
  }

  let body: { authorization?: string; indexData?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid request body.", 400);
  }

  const authorization = body.authorization?.trim();
  if (!authorization) {
    return jsonError("Missing authorization.", 400);
  }
  // Only the 8 MatchIndexData fields survive this — anything else in the
  // client's indexData (id, ingestStatus, …) is dropped, never written.
  const indexData = parseMatchIndexData(body.indexData);
  if (!indexData) {
    return jsonError("Missing or malformed indexData.", 400);
  }

  try {
    const summary = await ingestMatch(matchId, indexData, authorization);
    return NextResponse.json(summary);
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Something went wrong.", 502);
  }
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}
