import { afterEach, describe, expect, it, vi } from "vitest";
import { clearForumHandoff, consumeForumHandoff, FORUM_HANDOFF_KEY, readForumHandoff, resolveForumHandoff, storeForumHandoff, type ForumHandoff } from "./handoff";

const preview = {
  position: { mine: Array(24).fill(0), opponent: Array(24).fill(0), mineBar: 0, opponentBar: 0, mineOff: 0, opponentOff: 0 },
  cube: { kind: "owned" as const, value: 1, owner: "center" as const },
  dice: [6, 4],
  caption: "5-point match · 3–2 · 6-4 to play",
};

const matchHandoff: ForumHandoff = { match: { decisionId: 123 }, preview };

afterEach(() => vi.unstubAllGlobals());
describe("forum board handoff state", () => {
  it("treats no stored handoff as the ordinary text-only state", () => {
    expect(resolveForumHandoff(null)).toEqual({ kind: "absent" });
  });

  it("accepts a complete match handoff while keeping the action payload and preview distinct", () => {
    const result = resolveForumHandoff(matchHandoff);
    expect(result.kind).toBe("attached");
    if (result.kind === "attached") {
      expect("match" in result.handoff && result.handoff.match).toEqual({ decisionId: 123 });
      expect(result.handoff.preview.caption).toBe(preview.caption);
    }
  });

  it("falls back for malformed or unsupported stored data", () => {
    expect(resolveForumHandoff(undefined)).toEqual({ kind: "invalid" });
    expect(resolveForumHandoff({ match: { decisionId: "123" }, preview })).toEqual({ kind: "invalid" });
    expect(resolveForumHandoff({ ...matchHandoff, extra: "unsupported" })).toEqual({ kind: "invalid" });
  });

  it("canonicalizes manual previews from their submitted board IDs instead of trusting display data", () => {
    const handoff: ForumHandoff = {
      manual: { positionId: "4PPCATDgc/ABMA", gnuMatchId: "MAGzAAAACAAE", kind: "CHECKER" },
      preview: { ...preview, caption: "Raw GNU ID: must not appear" },
    };
    const result = resolveForumHandoff(handoff);
    expect(result.kind).toBe("attached");
    if (result.kind === "attached") {
      expect("manual" in result.handoff && result.handoff.preview.caption).toBe("5-point match · 0–1 · 6-4 to play");
    }
  });

  it("keeps the score-and-kind caption written by the source button", () => {
    const result = resolveForumHandoff({ ...matchHandoff, preview: { ...preview, caption: "5-point match · 1–3 · 6-4 to play" } });
    expect(result.kind).toBe("attached");
    if (result.kind === "attached") expect(result.handoff.preview.caption).toBe("5-point match · 1–3 · 6-4 to play");
  });

  it("does not expose identifiers from an untrusted match caption", () => {
    const result = resolveForumHandoff({ ...matchHandoff, preview: { ...preview, caption: "GNU ID ABC123" } });
    expect(result.kind).toBe("attached");
    if (result.kind === "attached") expect(result.handoff.preview.caption).toBe("Match position");
  });

  it("consumes a stored handoff exactly once", () => {
    const values = new Map<string, string>();
    vi.stubGlobal("window", { sessionStorage: {
      setItem: (key: string, value: string) => values.set(key, value),
      getItem: (key: string) => values.get(key) ?? null,
      removeItem: (key: string) => values.delete(key),
    } });
    storeForumHandoff(matchHandoff);
    expect(consumeForumHandoff()).toEqual(matchHandoff);
    expect(consumeForumHandoff()).toBeNull();
  });

  it("stores and clears one handoff under the shared session key", () => {
    const values = new Map<string, string>();
    vi.stubGlobal("window", { sessionStorage: {
      setItem: (key: string, value: string) => values.set(key, value),
      getItem: (key: string) => values.get(key) ?? null,
      removeItem: (key: string) => values.delete(key),
    } });
    expect(storeForumHandoff(matchHandoff)).toBe(true);
    expect([...values.keys()]).toEqual([FORUM_HANDOFF_KEY]);
    const result = resolveForumHandoff(readForumHandoff());
    expect(result.kind).toBe("attached");
    if (result.kind === "attached") expect("match" in result.handoff && result.handoff.match).toEqual({ decisionId: 123 });
    clearForumHandoff();
    expect(readForumHandoff()).toBeNull();
  });

  it("converts malformed stored JSON and unavailable storage into a non-throwing fallback", () => {
    vi.stubGlobal("window", { sessionStorage: {
      getItem: () => "{",
      setItem: () => { throw new Error("blocked"); },
      removeItem: () => { throw new Error("blocked"); },
    } });
    expect(resolveForumHandoff(readForumHandoff())).toEqual({ kind: "invalid" });
    expect(storeForumHandoff(matchHandoff)).toBe(false);
    expect(() => clearForumHandoff()).not.toThrow();
  });
});
