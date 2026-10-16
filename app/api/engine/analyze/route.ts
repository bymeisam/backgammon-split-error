import { NextResponse } from "next/server";
import { decodeGnuPositionId } from "@/lib/gnuPositionId";
import { requireMemberApi } from "@/lib/app-auth";
import { analyzePosition, EngineUnavailableError, type EngineRequest } from "@/lib/engine";
import { decodeGnuMatchId } from "@/lib/gnuMatchId";

export const dynamic = "force-dynamic";

function parseRequest(value: unknown): EngineRequest | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  if (typeof body.positionId !== "string" || !/^[A-Za-z0-9+/]{14}$/.test(body.positionId)) return null;
  if (typeof body.matchId !== "string" || !/^[A-Za-z0-9+/]{12}$/.test(body.matchId)) return null;
  try {
    const position = decodeGnuPositionId(body.positionId);
    if (position.mineOff < 0 || position.opponentOff < 0) return null;
    const match = decodeGnuMatchId(body.matchId);
    if (!match || match.gameState !== 1) return null;
    if (Object.keys(body).some((key) => !["kind", "positionId", "matchId", "dice"].includes(key))) return null;
    if (body.kind === "cube") {
      if ("dice" in body || match.dice.some((die) => die !== 0)) return null;
      return { kind: "cube", positionId: body.positionId, matchId: body.matchId };
    }
    if (body.kind === "checker" && Array.isArray(body.dice) && body.dice.length === 2 && body.dice.every((die) => Number.isInteger(die) && Number(die) >= 1 && Number(die) <= 6)) {
      return { kind: "checker", positionId: body.positionId, matchId: body.matchId, dice: [Number(body.dice[0]), Number(body.dice[1])] };
    }
  } catch {
    return null;
  }
  return null;
}

export async function POST(request: Request) {
  const denied = await requireMemberApi();
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const input = parseRequest(body);
  if (!input) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  try {
    const result = await analyzePosition(input);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof EngineUnavailableError) return NextResponse.json({ error: "engine_unavailable" }, { status: 503 });
    return NextResponse.json({ error: "analysis_failed" }, { status: 422 });
  }
}
