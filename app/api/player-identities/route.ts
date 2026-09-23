import { NextResponse } from "next/server";
import { prismaReadOnly as prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Read-only; no auth needed — PlayerIdentity is DB-only data, populated as a
// side effect of the analyses/list fetch (see app/api/galaxy/matches/list/
// [page]/route.ts). Used by MistakesSection to resolve a raw userId found in
// a match's decisions to a display name instead of asking the viewer to pick
// "which side is you" by hand. Uses the read-only client — this route never
// writes.
export async function GET() {
  const identities = await prisma.playerIdentity.findMany();
  return NextResponse.json(identities);
}
