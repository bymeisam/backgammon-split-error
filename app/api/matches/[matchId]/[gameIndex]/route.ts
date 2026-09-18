import { NextResponse } from "next/server";
import { localClient } from "@/lib/local-client";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ matchId: string; gameIndex: string }> }
) {
  const { matchId: matchIdParam, gameIndex: gameIndexParam } = await params;
  const matchId = Number(matchIdParam);
  const gameIndex = Number(gameIndexParam);

  if (!Number.isInteger(matchId) || !Number.isInteger(gameIndex)) {
    return NextResponse.json({ error: "Invalid matchId or gameIndex." }, { status: 400 });
  }

  const data = await localClient.getGameReviews(matchId, gameIndex);
  if (!data) {
    return NextResponse.json({ error: "Not ingested yet." }, { status: 404 });
  }

  return NextResponse.json(data);
}
