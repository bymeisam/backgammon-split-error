import { NextRequest, NextResponse } from "next/server";
import { createGalaxyClient } from "@/lib/galaxy-client";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ matchId: string; gameIndex: string }> }
) {
  const { matchId: matchIdParam, gameIndex: gameIndexParam } = await params;
  const matchId = Number(matchIdParam);
  const gameIndex = Number(gameIndexParam);

  if (!Number.isInteger(matchId) || !Number.isInteger(gameIndex)) {
    return jsonError("Invalid matchId or gameIndex.", 400);
  }

  let body: { authorization?: string };
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid request body.", 400);
  }

  const authorization = body.authorization?.trim();
  if (!authorization) {
    return jsonError("Missing authorization.", 400);
  }

  try {
    const data = await createGalaxyClient(authorization).getGameReviews(matchId, gameIndex);
    if (!data) {
      return jsonError("Not found.", 404);
    }
    return NextResponse.json(data);
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Something went wrong.", 502);
  }
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}
