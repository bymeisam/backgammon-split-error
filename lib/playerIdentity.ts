// Client-facing shape of a PlayerIdentity row, as served by
// app/api/player-identities/route.ts (the Prisma model also has `id`,
// which nothing on the client reads).
export interface PlayerIdentity {
  source: string;
  sourceUserId: string;
  displayName: string;
  isMe: boolean;
}

// "Which player is you" for a given set of decisions: the first isMe
// identity whose sourceUserId actually appears among `presentUserIds`, or
// null when none does. Shared by MistakesSection (client, all identities
// from the API) and the replay page (server, Prisma rows) so both resolve
// "me" by the same rule instead of two hand-synced copies. What to do on
// null is the caller's own policy — MistakesSection falls back to the
// first player seen, the replay hides its fixed-perspective toggle.
export function resolveMyIdentity<T extends Pick<PlayerIdentity, "isMe" | "sourceUserId">>(
  identities: readonly T[],
  presentUserIds: Iterable<string>
): T | null {
  const present = new Set(presentUserIds);
  return identities.find((i) => i.isMe && present.has(i.sourceUserId)) ?? null;
}

// "Who is the opponent" for a match's user ids: the first identity present
// in them that isn't isMe, or null. Used only for
// the match page's breadcrumb label; the per-match lists keep using
// resolveMyIdentity above.
export function resolveOpponentIdentity<T extends Pick<PlayerIdentity, "isMe" | "sourceUserId">>(
  identities: readonly T[],
  presentUserIds: Iterable<string>
): T | null {
  const present = new Set(presentUserIds);
  return identities.find((i) => !i.isMe && present.has(i.sourceUserId)) ?? null;
}
