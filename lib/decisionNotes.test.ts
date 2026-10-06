import { describe, expect, it } from "vitest";
import {
  NOTE_MAX_LENGTH,
  attachNotes,
  importOutcome,
  normalizeNote,
  parseDecisionId,
  type MatchDecisionNoteEntry,
} from "@/lib/decisionNotes";
import type { Decision } from "@/lib/mistakes";

describe("parseDecisionId", () => {
  it("accepts plain positive integers", () => {
    expect(parseDecisionId("1")).toBe(1);
    expect(parseDecisionId("123456")).toBe(123456);
  });

  it("rejects zero, negatives, decimals, exponents, padding and junk", () => {
    for (const bad of ["0", "-1", "1.5", "1e3", "01", " 1", "abc", "", "9999999999999999999"]) {
      expect(parseDecisionId(bad)).toBeNull();
    }
  });
});

describe("normalizeNote", () => {
  it("trims a real note", () => {
    expect(normalizeNote("  slot the 5 point \n")).toEqual({ ok: true, note: "slot the 5 point" });
  });

  it("treats empty and whitespace-only as a delete (null)", () => {
    expect(normalizeNote("")).toEqual({ ok: true, note: null });
    expect(normalizeNote("  \n\t ")).toEqual({ ok: true, note: null });
  });

  it("rejects non-strings and over-long notes", () => {
    expect(normalizeNote(undefined).ok).toBe(false);
    expect(normalizeNote(42).ok).toBe(false);
    expect(normalizeNote("x".repeat(NOTE_MAX_LENGTH)).ok).toBe(true);
    expect(normalizeNote("x".repeat(NOTE_MAX_LENGTH + 1)).ok).toBe(false);
  });
});

function liveDecision(gameIndex: number, eventId: string): Decision {
  return {
    id: `${gameIndex}:${eventId}`,
    gameIndex,
    userId: "u",
    color: "white",
    kind: "checker",
    absError: 0.1,
    isMistake: true,
    severity: "error",
    myLabel: "a",
    bestLabel: "b",
    roll: [],
    sourcePositionId: null,
    myMoveNotation: null,
    bestMoveNotation: null,
    cubeState: null,
  };
}

describe("attachNotes", () => {
  const entries: MatchDecisionNoteEntry[] = [
    { gameIndex: 1, eventId: "100", dbDecisionId: 11, note: "first" },
    { gameIndex: 2, eventId: "100", dbDecisionId: 22, note: null },
  ];

  it("matches on (gameIndex, eventId), not eventId alone", () => {
    const [a, b] = attachNotes([liveDecision(1, "100"), liveDecision(2, "100")], entries);
    expect(a).toMatchObject({ note: "first", dbDecisionId: 11 });
    expect(b).toMatchObject({ note: null, dbDecisionId: 22 });
  });

  it("leaves decisions the DB doesn't have with null note and dbDecisionId", () => {
    const [c] = attachNotes([liveDecision(3, "100")], entries);
    expect(c).toMatchObject({ note: null, dbDecisionId: null });
  });

  it("with no entries (match not ingested) nothing gets a DB id", () => {
    expect(attachNotes([liveDecision(1, "100")], [])[0].dbDecisionId).toBeNull();
  });
});

describe("importOutcome", () => {
  const t = (iso: string) => new Date(iso);

  it("is new when the decision has no note yet", () => {
    expect(importOutcome(null, t("2026-10-06T10:00:00Z"))).toBe("new");
  });

  it("updates only when the incoming note is strictly newer", () => {
    expect(importOutcome(t("2026-10-06T10:00:00Z"), t("2026-10-06T10:00:01Z"))).toBe("updated");
    expect(importOutcome(t("2026-10-06T10:00:00Z"), t("2026-10-06T10:00:00Z"))).toBe("skipped");
    expect(importOutcome(t("2026-10-06T10:00:01Z"), t("2026-10-06T10:00:00Z"))).toBe("skipped");
  });
});
