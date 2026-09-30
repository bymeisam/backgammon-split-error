// Throwaway verification helper — never imported or wired into any route.
import { prisma } from "@/lib/prisma";

export async function countHighErrorDecisions() {
  return prisma.decision.count({
    where: { errorSeverity: "BLUNDER" },
  });
}
