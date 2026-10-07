// App settings for the spaced-repetition review (Phase B of
// reports/2026-10-07-review-feature-plan.md), in one place so a future
// settings page has one file to read from and write to. Plain constants for
// now: no env var, no DB row.
//
// "Today" for the daily limits is the running server's own local day
// (midnight to midnight in the server process's time zone — lib/review/
// daily.ts's startOfLocalDay). The app runs on the user's own machine, so
// that's the user's day. On a server in another time zone (e.g. Vercel,
// UTC) the day would roll over at that zone's midnight instead; the live
// site is read-only and never reviews, so it doesn't arise today.

// New cards (never answered) introduced per day.
export const NEW_CARDS_PER_DAY = 20;

// Review-state cards answered per day. Learning/relearning cards (FSRS's
// short-term steps) don't count against it and are never held back by it,
// same as Anki: holding back a card that's mid-step would break its step.
export const REVIEWS_PER_DAY = 200;

// Cards loaded per request on /review; the next batch is fetched when the
// current one runs out.
export const REVIEW_BATCH_SIZE = 20;

// Galaxy's good/error boundary: an answer is correct when it loses at most
// this much equity against the best (lib/review/grading.ts).
export const CORRECT_LOSS_THRESHOLD = 0.02;

// The most decisions one "Add all to review" click on /mistakes adds.
export const BULK_ADD_CAP = 100;

// Same-session relearn delay: a card answered wrong (FSRS "Again") comes
// back in the same session after this many other cards, or at the end of
// the batch if fewer are left.
export const AGAIN_REQUEUE_AFTER_CARDS = 3;
