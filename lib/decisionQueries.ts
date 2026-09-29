// Small read-only Decision query helpers, ahead of a manual-tagging UI
// (Decision.myTag exists in the schema but has no reader anywhere yet).
import { prismaReadOnly as prisma } from "@/lib/prisma";

export async function findDecisionsByTag(tag: string) {
  return prisma.decision.findMany({
    where: { myTag: tag },
    orderBy: { id: "desc" },
  });
}
