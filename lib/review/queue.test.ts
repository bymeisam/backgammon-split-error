import { describe, expect, it } from "vitest";
import { CARD_STATE } from "@/lib/review/cardState";
import {
  dailyProgress,
  dueBucket,
  parseIdList,
  planQueue,
  requeueIndex,
  startOfLocalDay,
  startOfNextLocalDay,
  type QueueCandidate,
} from "@/lib/review/queue";

const now = new Date(2026, 9, 7, 15, 0, 0); // local 15:00
const min = (m: number) => new Date(now.getTime() + m * 60_000);

describe("local day", () => {
  it("today starts at local midnight, tomorrow at the next", () => {
    expect(startOfLocalDay(now)).toEqual(new Date(2026, 9, 7));
    expect(startOfNextLocalDay(now)).toEqual(new Date(2026, 9, 8));
  });
});

describe("dailyProgress", () => {
  it("counts each card once, by its state at its first answer today", () => {
    const logs = [
      { cardId: 1, reviewedAt: min(-50), stateBefore: { state: CARD_STATE.new } },
      { cardId: 1, reviewedAt: min(-40), stateBefore: { state: CARD_STATE.learning } }, // same card again
      { cardId: 2, reviewedAt: min(-30), stateBefore: { state: CARD_STATE.review } },
      { cardId: 3, reviewedAt: min(-20), stateBefore: { state: CARD_STATE.relearning } }, // not counted
      { cardId: 4, reviewedAt: min(-10), stateBefore: { state: CARD_STATE.review } },
      { cardId: 5, reviewedAt: min(-5), stateBefore: "junk" },
    ];
    expect(dailyProgress(logs)).toEqual({ newDone: 1, reviewsDone: 2 });
  });

  it("uses the earliest log per card even if logs come unordered", () => {
    const logs = [
      { cardId: 1, reviewedAt: min(-10), stateBefore: { state: CARD_STATE.learning } },
      { cardId: 1, reviewedAt: min(-50), stateBefore: { state: CARD_STATE.new } },
    ];
    expect(dailyProgress(logs)).toEqual({ newDone: 1, reviewsDone: 0 });
  });
});

describe("dueBucket", () => {
  it("new: always; learning/relearning: when past due; review: any time today", () => {
    expect(dueBucket({ id: 1, state: CARD_STATE.new, due: min(60) }, now)).toBe("new");
    expect(dueBucket({ id: 1, state: CARD_STATE.learning, due: min(-1) }, now)).toBe("learning");
    expect(dueBucket({ id: 1, state: CARD_STATE.learning, due: min(5) }, now)).toBeNull();
    expect(dueBucket({ id: 1, state: CARD_STATE.relearning, due: now }, now)).toBe("learning");
    expect(dueBucket({ id: 1, state: CARD_STATE.review, due: min(300) }, now)).toBe("review"); // 20:00 today
    expect(dueBucket({ id: 1, state: CARD_STATE.review, due: new Date(2026, 9, 8) }, now)).toBeNull();
  });
});

describe("planQueue", () => {
  const cards: QueueCandidate[] = [
    { id: 1, state: CARD_STATE.review, due: min(-100) },
    { id: 2, state: CARD_STATE.new, due: min(-90) },
    { id: 3, state: CARD_STATE.learning, due: min(-80) },
    { id: 4, state: CARD_STATE.review, due: min(-70) },
    { id: 5, state: CARD_STATE.new, due: min(-60) },
    { id: 6, state: CARD_STATE.new, due: min(-50) },
    { id: 7, state: CARD_STATE.learning, due: min(30) }, // not due yet
  ];
  const plan = (over: Partial<Parameters<typeof planQueue>[0]>) =>
    planQueue({
      candidates: cards,
      now,
      progress: { newDone: 0, reviewsDone: 0 },
      newPerDay: 20,
      reviewsPerDay: 200,
      exclude: new Set(),
      batchSize: 20,
      ...over,
    });

  it("learning first, then reviews, then new, each in due order", () => {
    const p = plan({});
    expect(p.batchIds).toEqual([3, 1, 4, 2, 5, 6]);
    expect(p.due).toEqual({ new: 3, review: 3 });
    expect(p.batchNew).toBe(3);
  });

  it("daily limits: new and review allowances shrink with today's progress; learning isn't limited", () => {
    const p = plan({ progress: { newDone: 19, reviewsDone: 199 }, newPerDay: 20, reviewsPerDay: 200 });
    expect(p.batchIds).toEqual([3, 1, 2]);
    expect(p.due).toEqual({ new: 1, review: 2 });
    const none = plan({ progress: { newDone: 25, reviewsDone: 250 } });
    expect(none.batchIds).toEqual([3]);
    expect(none.due).toEqual({ new: 0, review: 1 });
  });

  it("batch size cuts the batch, not the due counts", () => {
    const p = plan({ batchSize: 2 });
    expect(p.batchIds).toEqual([3, 1]);
    expect(p.due).toEqual({ new: 3, review: 3 });
    expect(p.batchNew).toBe(0);
  });

  it("excluded cards (already in the session) are skipped and not counted", () => {
    const p = plan({ exclude: new Set([1, 2, 3]) });
    expect(p.batchIds).toEqual([4, 5, 6]);
    expect(p.due).toEqual({ new: 2, review: 1 });
  });
});

describe("requeueIndex", () => {
  it("after N other cards, or at the end when fewer are left", () => {
    expect(requeueIndex(10, 3)).toBe(3);
    expect(requeueIndex(2, 3)).toBe(2);
    expect(requeueIndex(0, 3)).toBe(0);
  });
});

describe("parseIdList", () => {
  it("keeps positive integers, drops junk", () => {
    expect(parseIdList("1,2,x,0,-3,04,5")).toEqual([1, 2, 5]);
    expect(parseIdList("")).toEqual([]);
    expect(parseIdList(null)).toEqual([]);
  });
});
