import { describe, expect, it } from "vitest";
import { Rating, State } from "ts-fsrs";
import { CARD_STATE, RATING_VALUE, isRating, newSchedule, scheduleReview, scheduleToJson } from "@/lib/review/fsrs";

describe("FSRS wrapper (ts-fsrs, default parameters)", () => {
  const t0 = new Date("2026-10-07T10:00:00");

  it("stored state and rating numbers match ts-fsrs", () => {
    expect(CARD_STATE).toEqual({
      new: State.New,
      learning: State.Learning,
      review: State.Review,
      relearning: State.Relearning,
    });
    expect(RATING_VALUE).toEqual({ again: Rating.Again, hard: Rating.Hard, good: Rating.Good, easy: Rating.Easy });
  });

  it("a new card is New and due now", () => {
    const s = newSchedule(t0);
    expect(s.state).toBe(CARD_STATE.new);
    expect(s.due.getTime()).toBe(t0.getTime());
    expect(s.reps).toBe(0);
    expect(s.lastReview).toBeNull();
  });

  it("Good moves due forward and counts a rep", () => {
    const s = scheduleReview(newSchedule(t0), "good", t0);
    expect(s.due.getTime()).toBeGreaterThan(t0.getTime());
    expect(s.reps).toBe(1);
    expect(s.lastReview?.getTime()).toBe(t0.getTime());
  });

  it("Again keeps it short-term (learning, due within minutes)", () => {
    const s = scheduleReview(newSchedule(t0), "again", t0);
    expect(s.state).toBe(CARD_STATE.learning);
    expect(s.due.getTime() - t0.getTime()).toBeLessThanOrEqual(10 * 60_000);
  });

  it("Easy schedules further out than Hard", () => {
    const hard = scheduleReview(newSchedule(t0), "hard", t0);
    const easy = scheduleReview(newSchedule(t0), "easy", t0);
    expect(easy.due.getTime()).toBeGreaterThan(hard.due.getTime());
  });

  it("a review card answered Again lapses into relearning", () => {
    let s = scheduleReview(newSchedule(t0), "easy", t0);
    expect(s.state).toBe(CARD_STATE.review);
    s = scheduleReview(s, "again", s.due);
    expect(s.state).toBe(CARD_STATE.relearning);
    expect(s.lapses).toBe(1);
  });

  it("scheduleToJson snapshots every field, dates as ISO strings", () => {
    const s = scheduleReview(newSchedule(t0), "good", t0);
    const j = scheduleToJson(s);
    expect(j.due).toBe(s.due.toISOString());
    expect(j.lastReview).toBe(t0.toISOString());
    expect(Object.keys(j).sort()).toEqual(
      [
        "due",
        "stability",
        "difficulty",
        "elapsedDays",
        "scheduledDays",
        "learningSteps",
        "reps",
        "lapses",
        "state",
        "lastReview",
      ].sort()
    );
  });

  it("isRating", () => {
    expect(isRating("good")).toBe(true);
    expect(isRating("Good")).toBe(false);
    expect(isRating(3)).toBe(false);
  });
});
