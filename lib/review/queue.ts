// The review queue's rules: what "today" is, how much of today's daily
// limits is used, which cards are due, and which go in the next batch.
// Pure (no Prisma), so it's unit-tested; app/api/review/queue/route.ts feeds
// it rows.
//
// "Today" is the running server's local day (lib/settings.ts explains why).
//
// Due:
//   - New cards (never answered): always, up to NEW_CARDS_PER_DAY a day.
//   - Learning / relearning cards (FSRS's short-term steps): when their
//     due time has passed. Not limited (holding one back mid-step would
//     break the step), so they don't count against the review limit either.
//   - Review cards: due any time today (before the next local midnight),
//     up to REVIEWS_PER_DAY a day.
// A card counts against a limit once a day, by its state at its first
// answer that day; answering it again (an Again in the same session)
// doesn't count twice.
import { CARD_STATE } from "@/lib/review/cardState";

export function startOfLocalDay(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function startOfNextLocalDay(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
}

// One of today's ReviewLog rows. stateBefore is the JSON snapshot
// (lib/review/fsrs.ts's scheduleToJson).
export interface TodayLog {
  cardId: number;
  reviewedAt: Date;
  stateBefore: unknown;
}

function stateOf(snapshot: unknown): number | null {
  if (typeof snapshot !== "object" || snapshot === null) return null;
  const state = (snapshot as { state?: unknown }).state;
  return typeof state === "number" ? state : null;
}

export interface DailyProgress {
  newDone: number;
  reviewsDone: number;
}

export function dailyProgress(logs: readonly TodayLog[]): DailyProgress {
  const first = new Map<number, TodayLog>();
  for (const log of logs) {
    const seen = first.get(log.cardId);
    if (!seen || log.reviewedAt.getTime() < seen.reviewedAt.getTime()) first.set(log.cardId, log);
  }
  let newDone = 0;
  let reviewsDone = 0;
  for (const log of first.values()) {
    const state = stateOf(log.stateBefore);
    if (state === CARD_STATE.new) newDone++;
    else if (state === CARD_STATE.review) reviewsDone++;
  }
  return { newDone, reviewsDone };
}

export interface QueueCandidate {
  id: number;
  state: number;
  due: Date;
}

export type DueBucket = "new" | "learning" | "review";

// The bucket a card is due in, or null when it isn't due yet.
export function dueBucket(card: QueueCandidate, now: Date): DueBucket | null {
  if (card.state === CARD_STATE.new) return "new";
  if (card.state === CARD_STATE.learning || card.state === CARD_STATE.relearning) {
    return card.due.getTime() <= now.getTime() ? "learning" : null;
  }
  return card.due.getTime() < startOfNextLocalDay(now).getTime() ? "review" : null;
}

export interface QueuePlanInput {
  // Not suspended, matching the session's filters, in due order (due asc,
  // then id asc).
  candidates: readonly QueueCandidate[];
  now: Date;
  progress: DailyProgress;
  newPerDay: number;
  reviewsPerDay: number;
  // Cards this session already holds or has answered.
  exclude: ReadonlySet<number>;
  batchSize: number;
}

export interface QueuePlan {
  // The next batch: learning cards first, then review cards, then new
  // cards, each in due order.
  batchIds: number[];
  // Due counts after the daily limits, including the batch, excluding
  // `exclude`. `review` includes the learning cards.
  due: { new: number; review: number };
  // How many of the batch are new cards.
  batchNew: number;
}

export function planQueue(input: QueuePlanInput): QueuePlan {
  const buckets: Record<DueBucket, number[]> = { new: [], learning: [], review: [] };
  for (const c of input.candidates) {
    if (input.exclude.has(c.id)) continue;
    const bucket = dueBucket(c, input.now);
    if (bucket) buckets[bucket].push(c.id);
  }
  const newAllowance = Math.max(0, input.newPerDay - input.progress.newDone);
  const reviewAllowance = Math.max(0, input.reviewsPerDay - input.progress.reviewsDone);
  const learning = buckets.learning;
  const review = buckets.review.slice(0, reviewAllowance);
  const fresh = buckets.new.slice(0, newAllowance);

  const ordered = [...learning, ...review, ...fresh];
  const batchIds = ordered.slice(0, Math.max(0, input.batchSize));
  const freshIds = new Set(fresh);
  return {
    batchIds,
    due: { new: fresh.length, review: learning.length + review.length },
    batchNew: batchIds.filter((id) => freshIds.has(id)).length,
  };
}

// Where a card answered Again goes back into the session's local queue:
// after `after` other cards, or at the end when fewer are left.
export function requeueIndex(queueLength: number, after: number): number {
  return Math.min(Math.max(0, after), queueLength);
}

// Parses "1,2,3" (a session's exclude list) into ids; junk is ignored.
export function parseIdList(param: string | null | undefined): number[] {
  if (!param) return [];
  const ids: number[] = [];
  for (const part of param.split(",")) {
    if (/^[1-9]\d*$/.test(part)) {
      const n = Number(part);
      if (Number.isSafeInteger(n)) ids.push(n);
    }
  }
  return ids;
}
