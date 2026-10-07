"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AGAIN_REQUEUE_AFTER_CARDS } from "@/lib/settings";
import { CARD_STATE } from "@/lib/review/cardState";
import { buildQueryString } from "@/lib/listParams";
import { formatEquity, formatLoss, formatRelativeDue, questionFor } from "@/lib/review/format";
import { requeueIndex } from "@/lib/review/queue";
import { reviewFilterParams, type ReviewFilters } from "@/lib/review/filters";
import type {
  ReviewAnswerResponse,
  ReviewCardPayload,
  ReviewQueueResponse,
  ReviewSummaryResponse,
} from "@/lib/review/types";
import BoardPanel from "@/app/components/match-analysis/BoardPanel";
import DecisionNote from "@/app/components/match-analysis/DecisionNote";
import TagEditor from "@/app/components/review/TagEditor";
import { style } from "./review.styles";

type Rating = "hard" | "good" | "easy";

interface QueueItem {
  card: ReviewCardPayload;
  // Answered wrong earlier in this session and put back (FSRS "Again").
  requeued: boolean;
}

interface Answer {
  chosen: string;
  correct: boolean;
  loss: number;
}

type Save = { kind: "idle" } | { kind: "saving" } | { kind: "saved" } | { kind: "error"; message: string };

interface Stats {
  answered: number;
  correct: number;
  streak: number;
  bestStreak: number;
}

const NO_STATS: Stats = { answered: 0, correct: 0, streak: 0, bestStreak: 0 };

function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.tagName === "INPUT" || target.tagName === "TEXTAREA");
}

// One /review session. Cards come from GET /api/review/queue in batches of
// REVIEW_BATCH_SIZE; the next batch is fetched when the local queue runs
// out. Front: the board in quiz mode (decision-maker at the bottom, dice
// high first, the cube), the match context, the question and the options.
// Choosing an option reveals the back (graded with the card's own options —
// the server grades again when the answer is saved). A wrong answer is saved
// as Again straight away and the card comes back after
// AGAIN_REQUEUE_AFTER_CARDS other cards (or at the end of the batch); a
// right one is saved when the user rates it Hard / Good / Easy. Keys: 1–9
// pick an option; on the back, Enter = Next (wrong) and h / g / e rate.
export default function ReviewSession({ filters }: { filters: ReviewFilters }) {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [exhausted, setExhausted] = useState(false);
  const [beyond, setBeyond] = useState({ new: 0, review: 0 });
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [save, setSave] = useState<Save>({ kind: "idle" });
  const [stats, setStats] = useState<Stats>(NO_STATS);
  const [nextDue, setNextDue] = useState<string | null | undefined>(undefined);
  const seen = useRef(new Set<number>());
  // When the current card was shown (for ReviewLog.durationMs); set on load
  // and on every advance. State, not a ref: it's read in event handlers
  // defined during render.
  const [shownAt, setShownAt] = useState(0);

  const filterQuery = buildQueryString(reviewFilterParams(filters));
  const current = queue[0] ?? null;
  const done = !loading && exhausted && queue.length === 0;

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const exclude = [...seen.current].join(",");
      const sep = filterQuery ? "&" : "?";
      const res = await fetch(`/api/review/queue${filterQuery}${exclude ? `${sep}exclude=${exclude}` : ""}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as ReviewQueueResponse;
      for (const c of json.cards) seen.current.add(c.cardId);
      const batchReview = json.cards.length - json.batchNew;
      setBeyond({
        new: Math.max(0, json.due.new - json.batchNew),
        review: Math.max(0, json.due.review - batchReview),
      });
      if (json.cards.length === 0) setExhausted(true);
      setQueue((q) => [...q, ...json.cards.map((card) => ({ card, requeued: false }))]);
      setShownAt(Date.now());
    } catch (e) {
      setLoadError(`Couldn't load cards (${e instanceof Error ? e.message : "network error"}).`);
    } finally {
      setLoading(false);
    }
  }, [filterQuery]);

  useEffect(() => {
    // Fetching the first batch on mount (an external system) is this
    // effect's whole job; load() flips `loading` before its fetch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  // The end-of-session summary's "next due".
  useEffect(() => {
    if (!done || nextDue !== undefined) return;
    fetch(`/api/review/summary${filterQuery}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json: ReviewSummaryResponse | null) => setNextDue(json?.nextDue ?? null))
      .catch(() => setNextDue(null));
  }, [done, nextDue, filterQuery]);

  const submit = useCallback(
    async (item: QueueItem, a: Answer, rating: Rating | null): Promise<boolean> => {
      setSave({ kind: "saving" });
      try {
        const res = await fetch(`/api/review/cards/${item.card.cardId}/answer`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chosen: a.chosen, rating, durationMs: Math.max(0, Date.now() - shownAt) }),
        });
        const json = (await res.json().catch(() => null)) as (ReviewAnswerResponse & { error?: string }) | null;
        if (!res.ok || !json) {
          setSave({ kind: "error", message: json?.error ?? `Saving the answer failed (HTTP ${res.status}).` });
          return false;
        }
        setSave({ kind: "saved" });
        return true;
      } catch {
        setSave({ kind: "error", message: "Saving the answer failed (network error)." });
        return false;
      }
    },
    [shownAt]
  );

  function choose(key: string) {
    if (!current || answer) return;
    const option = current.card.options.find((o) => o.key === key);
    if (!option) return;
    const a = { chosen: key, correct: option.correct, loss: option.loss };
    setAnswer(a);
    setStats((s) => {
      const streak = a.correct ? s.streak + 1 : 0;
      return {
        answered: s.answered + 1,
        correct: s.correct + (a.correct ? 1 : 0),
        streak,
        bestStreak: Math.max(s.bestStreak, streak),
      };
    });
    // Wrong: recorded as Again straight away.
    if (!a.correct) submit(current, a, null);
  }

  function advance() {
    if (!current || !answer) return;
    const rest = queue.slice(1);
    const nextQueue = answer.correct
      ? rest
      : [
          ...rest.slice(0, requeueIndex(rest.length, AGAIN_REQUEUE_AFTER_CARDS)),
          { card: current.card, requeued: true },
          ...rest.slice(requeueIndex(rest.length, AGAIN_REQUEUE_AFTER_CARDS)),
        ];
    setQueue(nextQueue);
    setAnswer(null);
    setSave({ kind: "idle" });
    setShownAt(Date.now());
    if (nextQueue.length === 0 && !exhausted) load();
  }

  async function rate(rating: Rating) {
    if (!current || !answer?.correct || save.kind === "saving") return;
    if (await submit(current, answer, rating)) advance();
  }

  async function retryWrong() {
    if (current && answer && !answer.correct) await submit(current, answer, null);
  }

  // Keyboard shortcuts (not while typing in the note or tag input).
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey || !current) return;
      if (!answer) {
        const n = Number(e.key);
        if (Number.isInteger(n) && n >= 1 && n <= current.card.options.length) choose(current.card.options[n - 1].key);
        return;
      }
      if (!answer.correct && e.key === "Enter" && save.kind === "saved") advance();
      if (answer.correct && save.kind !== "saving") {
        if (e.key === "h") rate("hard");
        else if (e.key === "g" || e.key === "Enter") rate("good");
        else if (e.key === "e") rate("easy");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  // Header counts: what's left locally plus what the server said is due
  // beyond the loaded batch (daily limits applied).
  const localNew = queue.filter((q) => !q.requeued && q.card.state === CARD_STATE.new).length;
  const localReview = queue.length - localNew;
  const dueNew = beyond.new + localNew;
  const dueReview = beyond.review + localReview;

  const header = (
    <div data-testid="review-header" className={style.sessionHeader}>
      <span className={style.countNew}>New {dueNew}</span>
      <span className={style.countReview}>Review {dueReview}</span>
      <span className={style.countRemaining}>{dueNew + dueReview} remaining</span>
    </div>
  );

  if (loadError && queue.length === 0) {
    return (
      <div className={style.doneBox}>
        <p className={style.errorText}>{loadError}</p>
        <button type="button" onClick={load} className={style.ratingButton("next")}>
          Try again
        </button>
      </div>
    );
  }

  if (done) {
    const accuracy = stats.answered > 0 ? Math.round((stats.correct / stats.answered) * 100) : null;
    return (
      <div data-testid="review-summary" className={style.doneBox}>
        <h2 className={style.doneTitle}>{stats.answered > 0 ? "Session done" : "Nothing due"}</h2>
        <div className={style.summaryGrid}>
          <span className={style.summaryLabel}>Cards reviewed</span>
          <span className={style.summaryValue}>{stats.answered}</span>
          <span className={style.summaryLabel}>Accuracy</span>
          <span className={style.summaryValue}>{accuracy === null ? "—" : `${accuracy}%`}</span>
          <span className={style.summaryLabel}>Best streak</span>
          <span className={style.summaryValue}>{stats.bestStreak}</span>
          <span className={style.summaryLabel}>Next due</span>
          <span className={style.summaryValue}>
            {nextDue === undefined
              ? "…"
              : nextDue === null
                ? "no cards scheduled"
                : `${formatRelativeDue(new Date(nextDue), new Date())} (${new Date(nextDue).toLocaleString()})`}
          </span>
        </div>
        <Link href="/review/cards" className={style.link}>
          Manage cards
        </Link>
      </div>
    );
  }

  if (!current) {
    return (
      <>
        {header}
        <p className={style.mutedText}>{loadError ?? "Loading cards…"}</p>
      </>
    );
  }

  const card = current.card;
  const options = card.options;
  const chosenOption = answer ? options.find((o) => o.key === answer.chosen) : null;
  const bestOption = options.find((o) => o.key === card.bestKey);

  return (
    <>
      {header}
      <div className={style.layout}>
        <div className={style.boardColumn}>
          <BoardPanel key={`${card.cardId}-${stats.answered}`} selected={card.decision} moveTab="my" quiz />
        </div>

        <div className={style.sideColumn}>
          <div>
            {card.matchContext && <p className={style.contextLine}>{card.matchContext}</p>}
            <h2 data-testid="review-question" data-card-id={card.cardId} className={style.question}>
              {questionFor(card.question)}
            </h2>
          </div>

          {!answer ? (
            <div data-testid="review-options" className={style.optionList}>
              {options.map((o, i) => (
                <button
                  key={o.key}
                  type="button"
                  data-option-key={o.key}
                  onClick={() => choose(o.key)}
                  className={style.optionButton}
                >
                  <span className={style.optionKeyHint}>{i + 1}</span>
                  {o.label}
                </button>
              ))}
            </div>
          ) : (
            <>
              <p data-testid="review-verdict" className={style.verdict(answer.correct)}>
                {answer.correct ? "Correct" : "Incorrect"}
              </p>

              <div className={style.summaryGrid}>
                <span className={style.summaryLabel}>Your answer</span>
                <span className={style.summaryValue}>
                  {chosenOption?.label} ({formatLoss(answer.loss)})
                </span>
                <span className={style.summaryLabel}>Played in game</span>
                <span className={style.summaryValue}>{card.playedLabel}</span>
                <span className={style.summaryLabel}>Best</span>
                <span className={style.summaryValue}>{bestOption?.label}</span>
              </div>

              <div className={style.card}>
                <span className={style.cardLabel}>Options</span>
                <table className={style.table}>
                  <thead>
                    <tr>
                      <th className={style.tableHeadCell}>Option</th>
                      <th className={style.tableHeadCellRight}>Loss</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...options]
                      .sort((a, b) => b.loss - a.loss)
                      .map((o) => (
                        <tr
                          key={o.key}
                          className={style.optionRow({
                            isBest: o.key === card.bestKey,
                            isChosen: o.key === answer.chosen,
                            correct: o.correct,
                          })}
                        >
                          <td className={style.optionCell}>
                            {o.label}
                            {o.key === card.bestKey && <span className={style.optionTag}>best</span>}
                            {o.key === answer.chosen && <span className={style.optionTag}>your answer</span>}
                            {o.key === card.playedKey && <span className={style.optionTag}>played</span>}
                          </td>
                          <td className={style.tableCellRight}>{formatLoss(o.loss)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              {card.cube && (
                <div data-testid="review-cube-table" className={style.card}>
                  <span className={style.cardLabel}>Cube equities (doubler&apos;s view)</span>
                  <table className={style.table}>
                    <tbody>
                      <tr>
                        <td>No double</td>
                        <td className={style.tableCellRight}>{formatEquity(card.cube.nd)}</td>
                      </tr>
                      <tr>
                        <td>Double / Take</td>
                        <td className={style.tableCellRight}>{formatEquity(card.cube.dt)}</td>
                      </tr>
                      <tr>
                        <td>Double / Pass</td>
                        <td className={style.tableCellRight}>{formatEquity(card.cube.dp)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              <DecisionNote
                key={`note-${card.decisionId}`}
                note={card.decision.note}
                dbDecisionId={card.decisionId}
                canEditNotes
              />
              <div className={style.card}>
                <TagEditor key={`tags-${card.decisionId}`} dbDecisionId={card.decisionId} tags={card.decision.tags} canEdit />
              </div>

              <div className={style.linkRow}>
                <Link href={card.replayHref} className={style.link}>
                  Open in replay
                </Link>
                {card.externalHref && (
                  <a href={card.externalHref} target="_blank" rel="noopener noreferrer" className={style.link}>
                    View on Galaxy ↗
                  </a>
                )}
              </div>

              <div data-testid="review-rating" className={style.ratingRow}>
                {answer.correct ? (
                  <>
                    <button
                      type="button"
                      disabled={save.kind === "saving"}
                      onClick={() => rate("hard")}
                      className={style.ratingButton("hard")}
                    >
                      Hard
                    </button>
                    <button
                      type="button"
                      disabled={save.kind === "saving"}
                      onClick={() => rate("good")}
                      className={style.ratingButton("good")}
                    >
                      Good
                    </button>
                    <button
                      type="button"
                      disabled={save.kind === "saving"}
                      onClick={() => rate("easy")}
                      className={style.ratingButton("easy")}
                    >
                      Easy
                    </button>
                  </>
                ) : (
                  <>
                    <span className={style.mutedText}>
                      {save.kind === "saving" ? "Recording as Again…" : save.kind === "saved" ? "Recorded as Again." : ""}
                    </span>
                    {save.kind === "error" ? (
                      <button type="button" onClick={retryWrong} className={style.ratingButton("next")}>
                        Retry saving
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={save.kind !== "saved"}
                        onClick={advance}
                        className={style.ratingButton("next")}
                      >
                        Next
                      </button>
                    )}
                  </>
                )}
                {save.kind === "error" && <span className={style.errorText}>{save.message}</span>}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
