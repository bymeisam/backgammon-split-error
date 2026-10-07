// The FSRS scheduler behind a small wrapper, so nothing else in the app
// depends on the library's types. Uses ts-fsrs (open-spaced-repetition's
// TypeScript implementation, FSRS-6) with its default parameters: 90%
// requested retention, learning steps 1m/10m, relearning step 10m,
// interval fuzz on.
//
// A card's schedule is stored as ReviewCard's FSRS columns (prisma/
// schema.prisma); ReviewLog.stateBefore holds a CardSchedule snapshot
// (scheduleToJson) so schedules can be recomputed later.
import { createEmptyCard, fsrs, Rating, State, type Card, type Grade } from "ts-fsrs";

export type ReviewRating = "again" | "hard" | "good" | "easy";

// ts-fsrs's Rating values, as ReviewLog.rating stores them.
export const RATING_VALUE: Record<ReviewRating, number> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
};

export { CARD_STATE, CARD_STATE_LABEL } from "@/lib/review/cardState";

// ReviewCard's FSRS columns.
export interface CardSchedule {
  due: Date;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  learningSteps: number;
  reps: number;
  lapses: number;
  state: number;
  lastReview: Date | null;
}

const scheduler = fsrs();

function toCard(s: CardSchedule): Card {
  return {
    due: s.due,
    stability: s.stability,
    difficulty: s.difficulty,
    elapsed_days: s.elapsedDays,
    scheduled_days: s.scheduledDays,
    learning_steps: s.learningSteps,
    reps: s.reps,
    lapses: s.lapses,
    state: s.state as State,
    last_review: s.lastReview ?? undefined,
  };
}

function fromCard(c: Card): CardSchedule {
  return {
    due: c.due,
    stability: c.stability,
    difficulty: c.difficulty,
    elapsedDays: c.elapsed_days,
    scheduledDays: c.scheduled_days,
    learningSteps: c.learning_steps,
    reps: c.reps,
    lapses: c.lapses,
    state: c.state,
    lastReview: c.last_review ?? null,
  };
}

// A new card, due now.
export function newSchedule(now: Date): CardSchedule {
  return fromCard(createEmptyCard(now));
}

// The schedule after answering with `rating` at `now`.
export function scheduleReview(schedule: CardSchedule, rating: ReviewRating, now: Date): CardSchedule {
  return fromCard(scheduler.next(toCard(schedule), now, RATING_VALUE[rating] as Grade).card);
}

// JSON-safe snapshot (dates as ISO strings) for ReviewLog.stateBefore.
export function scheduleToJson(s: CardSchedule): Record<string, string | number | null> {
  return {
    due: s.due.toISOString(),
    stability: s.stability,
    difficulty: s.difficulty,
    elapsedDays: s.elapsedDays,
    scheduledDays: s.scheduledDays,
    learningSteps: s.learningSteps,
    reps: s.reps,
    lapses: s.lapses,
    state: s.state,
    lastReview: s.lastReview ? s.lastReview.toISOString() : null,
  };
}

export function isRating(v: unknown): v is ReviewRating {
  return v === "again" || v === "hard" || v === "good" || v === "easy";
}
