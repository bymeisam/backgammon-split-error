// ReviewCard.state values — ts-fsrs's State enum, as numbers. Its own
// module (no library import) so client code can use it without pulling in
// the scheduler; lib/review/fsrs.test.ts checks they match ts-fsrs.
export const CARD_STATE = {
  new: 0,
  learning: 1,
  review: 2,
  relearning: 3,
} as const;

export const CARD_STATE_LABEL: Record<number, string> = {
  0: "New",
  1: "Learning",
  2: "Review",
  3: "Relearning",
};
