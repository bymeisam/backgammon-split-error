import { describe, expect, it } from "vitest";
import { resolveMyIdentity, type PlayerIdentity } from "@/lib/playerIdentity";

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

  it("matches user ids case-sensitively", () => {
    // Galaxy ids are pinned to utf8mb4_bin (docs/field-mapping.md) — the
    // resolver must not be looser than the DB.
    expect(resolveMyIdentity([identity("AbC", true)], ["abc"])).toBeNull();
  });
});
