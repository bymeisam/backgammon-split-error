import { describe, expect, it } from "vitest";
import { resolveMyIdentity, resolveOpponentIdentity, type PlayerIdentity } from "@/lib/playerIdentity";

function identity(sourceUserId: string, isMe: boolean): PlayerIdentity {
  return { source: "galaxy", sourceUserId, displayName: `name-${sourceUserId}`, isMe };
}

describe("resolveMyIdentity", () => {
  it("returns the isMe identity present in the data", () => {
    const me = identity("u1", true);
    expect(resolveMyIdentity([identity("u2", false), me], ["u1", "u2"])).toBe(me);
  });

  it("ignores an isMe identity that doesn't appear in the data", () => {
    // e.g. a match between two other players, or an opponent-only replay.
    expect(resolveMyIdentity([identity("u1", true)], ["u2", "u3"])).toBeNull();
  });

  it("never picks a present identity that isn't isMe", () => {
    expect(resolveMyIdentity([identity("u2", false)], ["u2"])).toBeNull();
  });

  it("picks whichever isMe identity is present when there are several", () => {
    // One person, multiple accounts/sources: only the one in this match counts.
    const other = identity("u1", true);
    const here = identity("u9", true);
    expect(resolveMyIdentity([other, here], ["u9", "u5"])).toBe(here);
  });

  it("returns null for no identities or no users", () => {
    expect(resolveMyIdentity([], ["u1"])).toBeNull();
    expect(resolveMyIdentity([identity("u1", true)], [])).toBeNull();
  });

  it("accepts any iterable of user ids, including duplicates", () => {
    const me = identity("u1", true);
    expect(resolveMyIdentity([me], new Set(["u1"]))).toBe(me);
    expect(resolveMyIdentity([me], ["u1", "u1", "u2"])).toBe(me);
  });

  // The replay page used to fetch only findFirst({ isMe: true }) and check
  // that one row; it now passes every isMe row. With a single isMe identity
  // (the real DB's state when this changed) the two must agree exactly.
  it("matches the old first-isMe-only replay rule when there's one isMe identity", () => {
    const oldReplayRule = (first: PlayerIdentity | null, userIds: string[]) =>
      first && userIds.some((u) => u === first.sourceUserId) ? first.sourceUserId : null;
    const me = identity("u1", true);
    const all = [identity("u2", false), me, identity("u3", false)];
    for (const userIds of [["u1", "u2"], ["u2", "u3"], [], ["u1"]]) {
      expect(resolveMyIdentity(all, userIds)?.sourceUserId ?? null).toBe(oldReplayRule(me, userIds));
    }
  });

  it("matches user ids case-sensitively", () => {
    // Galaxy ids are pinned to utf8mb4_bin (docs/field-mapping.md) — the
    // resolver must not be looser than the DB.
    expect(resolveMyIdentity([identity("AbC", true)], ["abc"])).toBeNull();
  });
});

describe("resolveOpponentIdentity", () => {
  it("returns the present identity that isn't isMe", () => {
    const opp = identity("u2", false);
    expect(resolveOpponentIdentity([identity("u1", true), opp, identity("u3", false)], ["u1", "u2"])).toBe(opp);
  });

  it("returns null when no present identity is an opponent", () => {
    expect(resolveOpponentIdentity([identity("u1", true)], ["u1"])).toBeNull();
    expect(resolveOpponentIdentity([identity("u2", false)], ["u1"])).toBeNull();
    expect(resolveOpponentIdentity([], ["u1"])).toBeNull();
  });
});
