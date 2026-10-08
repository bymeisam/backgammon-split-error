// Read-only RepeatedPosition queries, shared by /repeated-positions' list
// and the dashboard's "Most repeated blunders" panel. prismaReadOnly only.
// RepeatedPosition is a small precomputed table (lib/recompute-repeated-
// positions.ts), so these need no index beyond its own.
import type { Prisma } from "@/lib/generated/prisma/client";
import { prismaReadOnly as prisma } from "@/lib/prisma";

// The most-faced repeated positions matching `where`, most faced first.
export function listRepeatedPositions(
  where: Prisma.RepeatedPositionWhereInput,
  { skip = 0, take }: { skip?: number; take: number }
) {
  return prisma.repeatedPosition.findMany({
    where,
    orderBy: { occurrenceCount: "desc" },
    skip,
    take,
  });
}
