import { describe, expect, it } from "vitest";
import { parseAnswerInput, positiveId, ratingFor } from "@/lib/review/requests";

describe("positiveId", () => {
  it("numbers and digit strings", () => {
    expect(positiveId(5)).toBe(5);
    expect(positiveId("12")).toBe(12);
    for (const bad of [0, -1, 1.5, "01", "1e3", "", null, undefined, "abc"]) expect(positiveId(bad)).toBeNull();
  });
});

describe("parseAnswerInput", () => {
  it("accepts chosen, optional rating and duration", () => {
    expect(parseAnswerInput({ chosen: "dt" })).toEqual({ ok: true, chosen: "dt", rating: null, durationMs: null });
    expect(parseAnswerInput({ chosen: "13/7 8/7", rating: "good", durationMs: 4200 })).toEqual({
      ok: true,
      chosen: "13/7 8/7",
      rating: "good",
      durationMs: 4200,
    });
  });
  it("rejects bad input", () => {
    expect(parseAnswerInput({}).ok).toBe(false);
    expect(parseAnswerInput({ chosen: "" }).ok).toBe(false);
    expect(parseAnswerInput({ chosen: "dt", rating: "great" }).ok).toBe(false);
    expect(parseAnswerInput({ chosen: "dt", durationMs: -1 }).ok).toBe(false);
    expect(parseAnswerInput({ chosen: "dt", durationMs: 1.5 }).ok).toBe(false);
  });
});

describe("ratingFor", () => {
  it("wrong is always Again", () => {
    expect(ratingFor(false, null)).toEqual({ ok: true, rating: "again" });
    expect(ratingFor(false, "again")).toEqual({ ok: true, rating: "again" });
    expect(ratingFor(false, "good").ok).toBe(false);
  });
  it("right needs hard, good or easy", () => {
    expect(ratingFor(true, "hard")).toEqual({ ok: true, rating: "hard" });
    expect(ratingFor(true, "easy")).toEqual({ ok: true, rating: "easy" });
    expect(ratingFor(true, null).ok).toBe(false);
    expect(ratingFor(true, "again").ok).toBe(false);
  });
});
