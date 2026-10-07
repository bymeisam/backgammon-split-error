import { describe, expect, it } from "vitest";
import { normalizeTagName, tagSuggestions, TAG_MAX_LENGTH } from "@/lib/review/tags";

describe("normalizeTagName", () => {
  it("trims and collapses whitespace", () => {
    expect(normalizeTagName("  prime   vs  prime ")).toEqual({ ok: true, name: "prime vs prime" });
  });
  it("rejects empty, non-strings and too long", () => {
    expect(normalizeTagName("   ").ok).toBe(false);
    expect(normalizeTagName(5).ok).toBe(false);
    expect(normalizeTagName("x".repeat(TAG_MAX_LENGTH + 1)).ok).toBe(false);
    expect(normalizeTagName("x".repeat(TAG_MAX_LENGTH)).ok).toBe(true);
  });
});

describe("tagSuggestions", () => {
  const all = [
    { id: 1, name: "backgame" },
    { id: 2, name: "Bearoff" },
    { id: 3, name: "prime" },
    { id: 4, name: "blitz" },
  ];
  it("case-insensitive contains, prefix matches first, excluding attached tags", () => {
    expect(tagSuggestions(all, "b", new Set()).map((t) => t.id)).toEqual([1, 2, 4]);
    expect(tagSuggestions(all, "ga", new Set()).map((t) => t.id)).toEqual([1]);
    expect(tagSuggestions(all, "B", new Set([2])).map((t) => t.id)).toEqual([1, 4]);
  });
  it("empty input lists tags up to the limit", () => {
    expect(tagSuggestions(all, "", new Set([3]), 2).map((t) => t.id)).toEqual([1, 2]);
  });
});
