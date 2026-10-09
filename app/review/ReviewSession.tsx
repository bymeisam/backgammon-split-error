"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { AGAIN_REQUEUE_AFTER_CARDS } from "@/lib/settings";
import { CARD_STATE } from "@/lib/review/cardState";
import { buildQueryString } from "@/lib/listParams";
import { formatEquity, formatLoss, formatRelativeDue, questionFor } from "@/lib/review/format";
import { requeueIndex } from "@/lib/review/queue";
import { reviewFilterParams, type ReviewFilters } from "@/lib/review/filters";
import { reviewKeyAction, type Rating } from "@/lib/reviewKeys";
import { stepIndex } from "@/lib/moveTableKeys";
import { reviewAnswerTier } from "@/lib/badges";
import type { MoveTab } from "@/lib/listSelection";
import { isIgnoredKeyEvent } from "@/app/hooks/useMoveTableKeys";
import type {
  ReviewAnswerResponse,
  ReviewCardPayload,
  ReviewQueueResponse,
  ReviewSummaryResponse,
} from "@/lib/review/types";
import BoardPanel from "@/app/components/match-analysis/BoardPanel";
import DecisionNote from "@/app/components/match-analysis/DecisionNote";
import TagEditor from "@/app/components/review/TagEditor";
import { FilterDefaultOpenContext } from "@/app/components/ui/FilterDisclosure";
import { useEffectiveTags } from "@/app/providers/ReviewStateProvider";
import { style } from "./review.styles";

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

// One /review session. Cards come from GET /api/review/queue in batches of
// REVIEW_BATCH_SIZE; the next batch is fetched when the local queue runs
// out. Front: the board in quiz mode (decision-maker at the bottom, dice
// high first, the cube), the match context, the question and the options.
// Choosing an option reveals the back (graded with the card's own options —
// the server grades again when the answer is saved). A wrong answer is saved
// as Again straight away and the card comes back after
// AGAIN_REQUEUE_AFTER_CARDS other cards (or at the end of the batch); a
// right one is saved when the user rates it Hard / Good / Easy. Keys
// (lib/reviewKeys.ts): on the front ↓ / ↑ (j / k) move the focus through
// the options, Enter or Space chooses the focused one, and 1–5 choose
// directly; on the back ← / → (h / l) switch the board between your answer
// and the best move (checker cards), Shift+H / Shift+G / Shift+E rate, and
// Enter is Good (right) or Next (wrong, once saved).
//
// The session bar on top: "Review", the progress ("Card N of M" and a
// track, N of the session's own total: what was answered plus what's still
// due — client state only), the due split, and `filterControls` (the page's
// FilterDisclosure), opened by default when the URL has filters but no card
// matches them.
export default function ReviewSession({
  filters,
  filterControls,
  hasFilters,
}: {
  filters: ReviewFilters;
  filterControls: ReactNode;
  hasFilters: boolean;
}) {
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
  // The back's board: your answer ("my") or the best move ("best", the
  // default, as before the tabs existed). Reset on every answer.
  const [backTab, setBackTab] = useState<MoveTab>("best");
  // The front's option buttons, for ↓ / ↑ (j / k) to move the focus.
  const optionsRef = useRef<HTMLDivElement>(null);

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
    setBackTab("best");
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

  // Moves the focus to the next/previous option button (stopping at the
  // ends; from outside the options, to the first). The focus ring is the
  // highlight, and Enter or Space on it is the button's own click.
  function moveOptionFocus(direction: 1 | -1): boolean {
    const buttons = [...(optionsRef.current?.querySelectorAll<HTMLButtonElement>("button[data-option-key]") ?? [])];
    const current = buttons.findIndex((b) => b === document.activeElement);
    const target = stepIndex(current, buttons.length, direction);
    if (target === null) return false;
    buttons[target].focus();
    return true;
  }

  // Keyboard shortcuts (lib/reviewKeys.ts), with the move tables' ignore
  // rules: not while typing in the note or tag input, with Cmd/Ctrl/Alt
  // held, or while a dialog is open. The key's default is prevented only
  // when it did something.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!current || isIgnoredKeyEvent(e)) return;
      const action = reviewKeyAction(
        e.key,
        e.shiftKey,
        answer
          ? {
              side: "back",
              correct: answer.correct,
              saveKind: save.kind,
              // No tabs when your answer is the best: one "Yours [Best]" chip
              // (BoardPanel), so ←/→ and h/l do nothing.
              hasTabs: current.card.question === "checker" && answer.chosen !== current.card.bestKey,
            }
          : { side: "front", optionCount: current.card.options.length }
      );
      if (!action) return;
      let handled = true;
      switch (action.type) {
        case "moveFocus":
          handled = moveOptionFocus(action.direction);
          break;
        case "choose":
          choose(current.card.options[action.index].key);
          break;
        case "tab":
          setBackTab(action.tab);
          break;
        case "rate":
          rate(action.rating);
          break;
        case "next":
          advance();
          break;
      }
      if (handled) e.preventDefault();
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
  // Progress through this session: answered so far (not counting the card
  // on screen) plus what's left, the card on screen included.
  const answeredBefore = stats.answered - (answer ? 1 : 0);
  const sessionTotal = answeredBefore + dueNew + dueReview;
  const progressPct = sessionTotal > 0 ? Math.min(100, (stats.answered / sessionTotal) * 100) : 0;

  const bar = (
    <div data-testid="review-header" className={style.sessionBar}>
      <h1 className={style.sessionTitle}>Review</h1>
      <div className={style.progress} aria-label="Session progress">
        {sessionTotal > 0 && (
          <span>
            Card {Math.min(answeredBefore + 1, sessionTotal)} of {sessionTotal}
          </span>
        )}
        <span className={style.track} aria-hidden="true">
          <span className={style.trackFill} style={{ width: `${progressPct}%` }} />
        </span>
        <span>
          {dueNew} new · {dueReview} review
        </span>
      </div>
      <FilterDefaultOpenContext.Provider value={hasFilters && done && stats.answered === 0}>
        {filterControls}
      </FilterDefaultOpenContext.Provider>
    </div>
  );

  if (loadError && queue.length === 0) {
    return (
      <>
        {bar}
        <div className={style.doneBox}>
          <p className={style.errorText}>{loadError}</p>
          <button type="button" onClick={load} className={style.retryButton}>
            Try again
          </button>
        </div>
      </>
    );
  }

  if (done) {
    const accuracy = stats.answered > 0 ? Math.round((stats.correct / stats.answered) * 100) : null;
    return (
      <>
        {bar}
        <div data-testid="review-summary" className={style.doneBox}>
          <h2 className={style.doneTitle}>{stats.answered > 0 ? "Session done" : "Nothing due"}</h2>
          {stats.answered === 0 && hasFilters && (
            <p className={style.mutedText}>No cards match these filters.</p>
          )}
          <div className={style.summaryGrid}>
            <span className={style.summaryLabel}>Cards reviewed</span>
            <span className={style.doneValue}>{stats.answered}</span>
            <span className={style.summaryLabel}>Accuracy</span>
            <span className={style.doneValue}>{accuracy === null ? "—" : `${accuracy}%`}</span>
            <span className={style.summaryLabel}>Best streak</span>
            <span className={style.doneValue}>{stats.bestStreak}</span>
            <span className={style.summaryLabel}>Next due</span>
            <span className={style.doneValue}>
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
      </>
    );
  }

  if (!current) {
    return (
      <>
        {bar}
        <p className={style.mutedText}>{loadError ?? "Loading cards…"}</p>
      </>
    );
  }

  const card = current.card;
  const options = card.options;
  const chosenOption = answer ? options.find((o) => o.key === answer.chosen) : null;
  const bestOption = options.find((o) => o.key === card.bestKey);
  const playedOption = card.playedKey ? options.find((o) => o.key === card.playedKey) : null;
  const question = questionFor(card.question);
  const [matchLead, ...matchRest] = card.matchContext ? card.matchContext.split(" · ") : [];
  const offer = card.decision.doubleOffer;
  const situation =
    card.question === "checker"
      ? card.decision.roll.length === 2
        ? `you rolled ${card.decision.roll[0]}-${card.decision.roll[1]}`
        : null
      : card.question === "doubler"
        ? "cube action, before your roll"
        : offer
          ? `opponent ${offer.redouble ? "redoubles" : "doubles"} to ${offer.value}`
          : "opponent doubles";
  const bestLabel = bestOption?.label ?? "?";
  // The back's "Yours" tab and its arrows (lib/badges.ts's reviewAnswerTier).
  const yoursTier = answer ? reviewAnswerTier(answer.chosen === card.bestKey, answer.correct) : "best";
  const verdictSub = !answer
    ? ""
    : answer.chosen === card.bestKey
      ? `${bestLabel} is the best ${card.question === "checker" ? "play" : "action"}.`
      : answer.correct
        ? `Best is ${bestLabel}. Yours loses only ${Math.abs(answer.loss).toFixed(3)}.`
        : `Best is ${bestLabel}. You lose ${Math.abs(answer.loss).toFixed(3)}.`;
  const noteEmptyText =
    card.question === "checker"
      ? "No note yet. What made this the best play?"
      : bestLabel.startsWith("Double")
        ? "No note yet. What made this a double?"
        : "No note yet. What made this the right action?";

  const context = (
    <p className={style.contextLine}>
      {matchLead && <b className={style.contextStrong}>{matchLead}</b>}
      {matchRest.map((part) => (
        <span key={part}>{part}</span>
      ))}
      {matchLead && situation && <span aria-hidden="true">·</span>}
      {situation && <span>{situation}</span>}
    </p>
  );

  return (
    <>
      {bar}
      <div className={style.layout}>
        <div className={style.boardColumn}>
          <BoardPanel
            key={`${card.cardId}-${stats.answered}`}
            selected={card.decision}
            moveTab={backTab}
            onSelectTab={setBackTab}
            quiz
            quizArrows={answer && card.question === "checker" ? (backTab === "my" ? answer.chosen : card.bestKey) : null}
            quizArrowTier={answer && backTab === "my" ? yoursTier : "best"}
            quizTabs={
              answer && card.question === "checker" && chosenOption
                ? {
                    yours: { label: chosenOption.label, tier: yoursTier, loss: answer.loss },
                    best: { label: bestLabel },
                    yoursIsBest: answer.chosen === card.bestKey,
                  }
                : null
            }
            bleed
          />
        </div>

        <div className={style.sideColumn}>
          {!answer ? (
            <>
              <div>
                {context}
                <h2 data-testid="review-question" data-card-id={card.cardId} className={style.question}>
                  {question.lead} <em className={style.questionAsk}>{question.ask}</em>
                </h2>
              </div>
              <div ref={optionsRef} data-testid="review-options" className={style.optionList}>
                {options.map((o, i) => (
                  <button
                    key={o.key}
                    type="button"
                    data-option-key={o.key}
                    onClick={() => choose(o.key)}
                    aria-keyshortcuts={i < 9 ? String(i + 1) : undefined}
                    className={style.optionButton}
                  >
                    <kbd className={style.optionKeyHint}>{i + 1}</kbd>
                    <span className={style.optionMove}>{o.label}</span>
                  </button>
                ))}
              </div>
              <p className={style.hint}>
                Press 1–{options.length} to answer, or move with ↓ / ↑ (J / K) and press Enter.
              </p>
            </>
          ) : (
            <>
              <div>
                {context}
                <p className={style.verdictRow} role="status">
                  <span data-testid="review-verdict" className={style.verdictWord(answer.correct)}>
                    {answer.correct ? "Correct." : "Not quite."}
                  </span>
                  <span className={style.verdictSub}>{verdictSub}</span>
                </p>
              </div>

              <dl className={style.summaryGrid}>
                <dt className={style.summaryLabel}>Your answer</dt>
                <dd className={style.summaryValue}>
                  {chosenOption?.label} <span className={style.summaryEquity}>{formatLoss(answer.loss)}</span>
                </dd>
                <dt className={style.summaryLabel}>Played in game</dt>
                <dd className={style.summaryValue}>
                  {card.playedLabel}
                  {playedOption && (
                    <>
                      {" "}
                      <span className={style.summaryEquity}>{formatLoss(playedOption.loss)}</span>
                    </>
                  )}
                </dd>
                <dt className={style.summaryLabel}>Best</dt>
                <dd className={style.summaryValue}>{bestLabel}</dd>
              </dl>

              <div className={style.optionsCard}>
                <table className={style.optionsTable}>
                  <caption className={style.optionsCaption}>Options · equity loss</caption>
                  <tbody>
                    {[...options]
                      .sort((a, b) => b.loss - a.loss)
                      .map((o) => {
                        const isBest = o.key === card.bestKey;
                        const isChosen = o.key === answer.chosen;
                        const chosenWrong = isChosen && !o.correct;
                        const tags = [
                          isBest && "best",
                          isChosen && "your answer",
                          o.key === card.playedKey && "played",
                        ].filter((t): t is string => Boolean(t));
                        const tagText = tags.length
                          ? tags.join(" · ").replace(/^./, (c) => c.toUpperCase())
                          : null;
                        return (
                          <tr key={o.key} className={style.optionRow({ isBest, isChosen, correct: o.correct })}>
                            <td className={style.optionCell({ isBest, chosenWrong })}>
                              {o.label}
                              {tagText && <span className={style.optionTag}>{tagText}</span>}
                            </td>
                            <td className={style.optionLoss(chosenWrong)}>{formatLoss(o.loss)}</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
                {card.cube && (
                  <div
                    data-testid="review-cube-table"
                    className={style.equities}
                    aria-label="Cube equities, doubler's view"
                  >
                    <div className={style.equityCell}>
                      <span className={style.equityLabel}>No double</span>
                      <span className={style.equityValue}>{formatEquity(card.cube.nd)}</span>
                    </div>
                    <div className={style.equityCell}>
                      <span className={style.equityLabel}>Double / Take</span>
                      <span className={style.equityValue}>{formatEquity(card.cube.dt)}</span>
                    </div>
                    <div className={style.equityCell}>
                      <span className={style.equityLabel}>Double / Pass</span>
                      <span className={style.equityValue}>{formatEquity(card.cube.dp)}</span>
                    </div>
                  </div>
                )}
              </div>

              <ReviewNote
                key={`note-${card.decisionId}`}
                card={card}
                emptyText={noteEmptyText}
              />

              <div
                data-testid="review-rating"
                role="group"
                aria-label={answer.correct ? "How hard was it?" : "Recorded as Again"}
                className={style.grade}
              >
                {answer.correct ? (
                  <>
                    <button
                      type="button"
                      disabled={save.kind === "saving"}
                      onClick={() => rate("hard")}
                      className={style.gradeButton({ primary: false, wide: false })}
                      aria-keyshortcuts="Shift+H"
                    >
                      <span className={style.gradeLabel}>Hard</span>
                      <span className={style.gradeKey(false)} aria-hidden="true">
                        ⇧H
                      </span>
                    </button>
                    <button
                      type="button"
                      disabled={save.kind === "saving"}
                      onClick={() => rate("good")}
                      className={style.gradeButton({ primary: true, wide: false })}
                      aria-keyshortcuts="Shift+G Enter"
                    >
                      <span className={style.gradeLabel}>Good</span>
                      <span className={style.gradeKey(true)} aria-hidden="true">
                        ⇧G · Enter
                      </span>
                    </button>
                    <button
                      type="button"
                      disabled={save.kind === "saving"}
                      onClick={() => rate("easy")}
                      className={style.gradeButton({ primary: false, wide: false })}
                      aria-keyshortcuts="Shift+E"
                    >
                      <span className={style.gradeLabel}>Easy</span>
                      <span className={style.gradeKey(false)} aria-hidden="true">
                        ⇧E
                      </span>
                    </button>
                  </>
                ) : save.kind === "error" ? (
                  <button
                    type="button"
                    onClick={retryWrong}
                    className={style.gradeButton({ primary: true, wide: true })}
                  >
                    <span className={style.gradeLabel}>Retry saving</span>
                    <span className={style.gradeKey(true)}>Not recorded yet</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={save.kind !== "saved"}
                    onClick={advance}
                    className={style.gradeButton({ primary: true, wide: true })}
                    aria-keyshortcuts="Enter"
                  >
                    <span className={style.gradeLabel}>Next card</span>
                    <span className={style.gradeKey(true)}>
                      {save.kind === "saved" ? "Recorded as Again · Enter" : "Recording as Again…"}
                    </span>
                  </button>
                )}
              </div>
              {save.kind === "error" && <p className={style.errorText}>{save.message}</p>}

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
            </>
          )}
        </div>
      </div>
    </>
  );
}

// The review back's note card: the note as text with an "Edit note" /
// "Write note" toggle, and the decision's tags in its foot.
function ReviewNote({ card, emptyText }: { card: ReviewCardPayload; emptyText: string }) {
  const tags = useEffectiveTags({ dbDecisionId: card.decisionId, tags: card.decision.tags });
  return (
    <DecisionNote
      note={card.decision.note}
      dbDecisionId={card.decisionId}
      canEditNotes
      toggle={{ emptyText }}
      hasTags={tags.length > 0}
      tags={<TagEditor key={`tags-${card.decisionId}`} dbDecisionId={card.decisionId} tags={card.decision.tags} canEdit />}
    />
  );
}
