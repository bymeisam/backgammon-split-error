import { NextRequest, NextResponse } from "next/server";
import { runSync } from "@/lib/sync";

export const dynamic = "force-dynamic";

// Deliberately conservative — comfortably inside Vercel Hobby's default 10s
// execution window (each match costs a handful of Galaxy requests plus DB
// writes). Tunable: raise it if Hobby's limit changes or matches trend
// smaller; lower it if they trend larger.
const MAX_MATCHES_PER_REQUEST = 20;

export async function POST(req: NextRequest) {
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
    const result = await runSync({
      token: authorization,
      type: "INCREMENTAL",
      maxMatchesToProcess: MAX_MATCHES_PER_REQUEST,
    });

    const message =
      result.stillPending > 0
        ? `${result.matchesProcessed} matches processed, ${result.stillPending} still pending — run scripts/incremental-sync.ts locally to finish.`
        : `${result.matchesProcessed} matches processed, all caught up.`;

    return NextResponse.json({ ...result, message });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Something went wrong.", 502);
  }
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}
