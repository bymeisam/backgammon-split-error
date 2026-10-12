import "server-only";
import { prismaAuth, prismaReadOnly } from "@/lib/prisma";
import { getAppAuthState } from "@/lib/app-auth";
import { isLocalAuthBypass, LOCAL_DEV_OWNER_CLERK_ID } from "@/lib/localAuthBypass";
import { isGalaxyEnabled } from "@/lib/galaxyGate";
import { decodeGnuMatchId } from "@/lib/gnuMatchId";
import { decodeGnuPositionId } from "@/lib/gnuPositionId";

export const FORUM_LIMITS = { title: 191, body: 20_000 } as const;

export function textField(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text.length > 0 && text.length <= max ? text : null;
}

export function validIds(positionId: unknown, gnuMatchId: unknown): positionId is string {
  return typeof positionId === "string" && decodePosition(positionId) !== null &&
    typeof gnuMatchId === "string" && decodeGnuMatchId(gnuMatchId) !== null;
}

export function decodePosition(id: string) {
  try { return decodeGnuPositionId(id); } catch { return null; }
}

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

export async function writeAllowed() { return isGalaxyEnabled(); }

export async function sourceDecision(id: number) {
  return prismaReadOnly.decision.findUnique({
    where: { id },
    select: { id: true, kind: true, sourcePositionId: true, raw: true },
  });
}

export function rawMatchId(raw: unknown): string | null {
  const value = (raw as { reviews?: Array<{ source_match?: { formatted_value?: unknown } | null }> } | null)?.reviews?.[0]?.source_match?.formatted_value;
  return typeof value === "string" ? value : null;
}
