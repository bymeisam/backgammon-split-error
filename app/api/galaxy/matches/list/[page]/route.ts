import { NextRequest, NextResponse } from "next/server";
import { createGalaxyClient } from "@/lib/galaxy-client";
import { prisma } from "@/lib/prisma";

const SOURCE = "galaxy";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ page: string }> }
) {
  const { page: pageParam } = await params;
  const page = Number(pageParam);

  if (!Number.isInteger(page) || page < 1) {
    return jsonError("Invalid page.", 400);
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
    const data = await createGalaxyClient(authorization).listMatches(page);

    // Best-effort: this is how PlayerIdentity ever gets populated (from the
    // authenticated user's own userId/userName on this response), but a
    // failure here shouldn't block returning the match list itself.
    try {
      await prisma.playerIdentity.upsert({
        where: { source_sourceUserId: { source: SOURCE, sourceUserId: data.userId } },
        create: { source: SOURCE, sourceUserId: data.userId, displayName: data.userName },
        update: { displayName: data.userName },
      });
    } catch (e) {
      console.error("Failed to upsert PlayerIdentity:", e);
    }

    return NextResponse.json(data);
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Something went wrong.", 502);
  }
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}
