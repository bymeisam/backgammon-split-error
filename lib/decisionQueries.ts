// Small read-only Decision query helpers, ahead of a manual-tagging UI
// (Decision.myTag exists in the schema but has no reader anywhere yet).
import { prismaReadOnly as prisma } from "@/lib/prisma";
import type { DecisionKind } from "@/lib/generated/prisma/client";

export async function findDecisionsByTag(tag: string) {
  return prisma.decision.findMany({
    where: { myTag: tag },
    orderBy: { id: "desc" },
  });
}

export async function findRecentDecisionsByKind(kind: DecisionKind, limit: number) {
  return prisma.decision.findMany({
    where: { kind },
    orderBy: { timestamp: "desc" },
    take: limit,
  });
}
