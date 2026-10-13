import "server-only";
import { prismaAuth, prismaReadOnly } from "@/lib/prisma";
import { getAppAuthState } from "@/lib/app-auth";
import { isLocalAuthBypass, LOCAL_DEV_OWNER_CLERK_ID } from "@/lib/localAuthBypass";
import { isGalaxyEnabled } from "@/lib/galaxyGate";
import { decodeGnuMatchId } from "@/lib/gnuMatchId";
import { decodeGnuPositionId } from "@/lib/gnuPositionId";

// Shared helpers for the forum's API routes (app/api/forum/*).

// Maximum lengths for posted text, and the most positions one post can attach.
export const FORUM_LIMITS = { title: 191, body: 20_000, positions: 4 } as const;

// A trimmed, non-empty string no longer than `max`, or null.
export function textField(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text.length > 0 && text.length <= max ? text : null;
}

// Whether both are strings that decode as a GNU Position ID and GNU Match ID.
export function validIds(positionId: unknown, gnuMatchId: unknown): positionId is string {
  return (
    typeof positionId === "string" &&
    decodePosition(positionId) !== null &&
    typeof gnuMatchId === "string" &&
    decodeGnuMatchId(gnuMatchId) !== null
  );
}

// decodeGnuPositionId, with null instead of a throw for an invalid ID.
export function decodePosition(id: string) {
  try {
    return decodeGnuPositionId(id);
  } catch {
    return null;
  }
}

// The signed-in owner's AppUser row, or null when the visitor isn't the
// approved owner. With the local AUTH_BYPASS on, the reserved local-dev-owner
// row is created on first use and returned instead.
export async function ownerIdentity() {
  const auth = await getAppAuthState();
  if (!auth || !auth.isOwner || !auth.clerkIsOwner) return null;

  if (isLocalAuthBypass()) {
    return prismaAuth.appUser.upsert({
      where: { clerkUserId: LOCAL_DEV_OWNER_CLERK_ID },
      create: { clerkUserId: LOCAL_DEV_OWNER_CLERK_ID, displayName: "Local development owner", isOwner: true },
      update: { displayName: "Local development owner", isOwner: true },
    });
  }
  return prismaAuth.appUser.findUnique({ where: { clerkUserId: auth.clerkUserId } });
}

// Forum writes follow the app-wide write gate (lib/galaxyGate.ts).
export async function writeAllowed() {
  return isGalaxyEnabled();
}

// The fields of a Decision a forum attachment is built from.
export async function sourceDecision(id: number) {
  return prismaReadOnly.decision.findUnique({
    where: { id },
    select: { id: true, kind: true, sourcePositionId: true, raw: true },
  });
}

// The GNU Match ID stored in a Decision's raw payload
// (reviews[0].source_match.formatted_value), or null if it isn't there.
export function rawMatchId(raw: unknown): string | null {
  type RawWithMatch = { reviews?: Array<{ source_match?: { formatted_value?: unknown } | null }> } | null;
  const value = (raw as RawWithMatch)?.reviews?.[0]?.source_match?.formatted_value;
  return typeof value === "string" ? value : null;
}
