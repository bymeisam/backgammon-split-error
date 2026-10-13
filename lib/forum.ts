import "server-only";
import { prismaApp, prismaReadOnly } from "@/lib/prisma";
import { getAppAuthState } from "@/lib/app-auth";
import { isLocalAuthBypass, localBypassIdentity } from "@/lib/localAuthBypass";
import { isMemberOrOwner, type AppRole } from "@/lib/appRole";
import { decodeGnuMatchId } from "@/lib/gnuMatchId";
import { decodeGnuPositionId } from "@/lib/gnuPositionId";

// Shared helpers for the forum's API routes (app/api/forum/*).

// Maximum lengths for posted text, and the most positions one post can attach.
export const FORUM_LIMITS = { title: 191, body: 20_000, positions: 4 } as const;

// A route's [id] segment as a positive integer, or null for anything else
// (non-numeric, fractional, zero or negative). Shared by the forum's [id]
// API routes.
export function parseId(value: string): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// A trimmed, non-empty string no longer than `max`, or null.
export function textField(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text.length > 0 && text.length <= max ? text : null;
}

// An optional boolean field (e.g. a post's hideAnalysis): "absent" when it
// isn't in the request, the boolean when it is one, "invalid" otherwise
// (null, a string, a number…).
export function optionalBoolean(value: unknown): boolean | "absent" | "invalid" {
  if (value === undefined) return "absent";
  return typeof value === "boolean" ? value : "invalid";
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

// The signed-in viewer's AppUser id and role, or null unless they're a
// member or the owner (lib/appRole.ts). With the local AUTH_BYPASS on, the
// reserved bypass row (local-dev-owner, or local-dev-member under
// AUTH_BYPASS_ROLE=member) is created on first use and returned instead.
export async function forumIdentity(): Promise<{ id: number; role: AppRole } | null> {
  const auth = await getAppAuthState();
  if (!auth || !isMemberOrOwner(auth.role)) return null;

  if (isLocalAuthBypass()) {
    const { clerkUserId, displayName, role, storedRole } = localBypassIdentity();
    // Stored role on create only; the returned role is the in-memory one.
    const row = await prismaApp.appUser.upsert({
      where: { clerkUserId },
      create: { clerkUserId, displayName, role: storedRole },
      update: { displayName },
      select: { id: true },
    });
    return { id: row.id, role };
  }
  const row = await prismaApp.appUser.findUnique({ where: { clerkUserId: auth.clerkUserId }, select: { id: true } });
  return row ? { id: row.id, role: auth.role } : null;
}

// The viewer's AppUser id and role for the forum pages' Edit/Delete
// controls (read-only: no bypass upsert). Null when not a member or owner,
// or when the row doesn't exist yet.
export async function forumViewer(): Promise<{ id: number; role: AppRole } | null> {
  const auth = await getAppAuthState();
  if (!auth || !isMemberOrOwner(auth.role)) return null;
  const row = await prismaReadOnly.appUser.findUnique({ where: { clerkUserId: auth.clerkUserId }, select: { id: true } });
  return row ? { id: row.id, role: auth.role } : null;
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
