// Server-only helpers for the review routes (Prisma).
import { Prisma } from "@/lib/generated/prisma/client";

// A unique-constraint violation (Prisma P2002) — e.g. two requests adding
// the same decision to review, or creating the same tag, at once.
export function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

// Columns the eligibility rule needs, plus the source.
export const ELIGIBILITY_SELECT = {
  id: true,
  kind: true,
  countAsDecision: true,
  rawError: true,
  raw: true,
  game: { select: { match: { select: { source: true } } } },
} satisfies Prisma.DecisionSelect;
