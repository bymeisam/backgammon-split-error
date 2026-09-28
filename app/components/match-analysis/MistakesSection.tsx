"use client";

import { useEffect, useMemo, useState } from "react";
import {
  combinePR,
  computePR,
  extractDecisions,
  extractGameIndexes,
  extractPlayerOptions,
  type Decision,
  type FetchedGame,
} from "@/lib/mistakes";
import BoardPanel from "./BoardPanel";
import { DiceRoll } from "./Dice";
import { style } from "./MistakesSection.styles";
import { style as moveDeltaStyle } from "./MoveDelta.styles";

interface PlayerIdentity {
  source: string;
  sourceUserId: string;
  displayName: string;
  isMe: boolean;
}

function formatPR(pr: number | null): string {
  return pr === null ? "—" : pr.toFixed(2);
}

// Exported for app/components/match-analysis/DecisionListWithDetail.tsx
// (the /mistakes list panel), which reuses this exact component/styling
// directly rather than a re-implementation, per the ask.
export function MoveDelta({
  decision,
  activeTab,
  onSelectTab,
}: {
  decision: Decision;
  activeTab?: "my" | "best" | null;
  onSelectTab?: (tab: "my" | "best") => void;
}) {
  return (
    <span data-testid="move-delta" className={moveDeltaStyle.wrapper}>
      <span
        className={moveDeltaStyle.myLabel(decision.severity, activeTab === "my")}
        onClick={(e) => {
          e.stopPropagation();
          onSelectTab?.("my");
        }}
      >
        {decision.myLabel}
      </span>
      <span
        className={moveDeltaStyle.bestLabel(activeTab === "best")}
        onClick={(e) => {
          e.stopPropagation();
          onSelectTab?.("best");
        }}
      >
        {decision.bestLabel}
      </span>
    </span>
  );
}

function MistakeTable({
  title,
  mistakes,
  isTicked,
  toggle,
  setAll,
  selectedId,
  onSelectRow,
  moveTab,
}: {
  title: string;
  mistakes: Decision[];
  isTicked: (id: string) => boolean;
  toggle: (id: string) => void;
  setAll: (ids: string[], value: boolean) => void;
  selectedId: string | null;
  onSelectRow: (id: string, tab?: "my" | "best") => void;
  moveTab: "my" | "best";
}) {
  const ids = mistakes.map((m) => m.id);

  return (
    <div className={style.mistakeTableWrapper}>
      <div className={style.mistakeTableHeader}>
        <h3 className={style.mistakeTableTitle}>{title}</h3>
        <div className={style.mistakeTableActions}>
          <button
            type="button"
            onClick={() => setAll(ids, true)}
            className={style.mistakeTableActionButton}
          >
            Select all
          </button>
          <button
            type="button"
            onClick={() => setAll(ids, false)}
            className={style.mistakeTableActionButton}
          >
            Select none
          </button>
        </div>
      </div>

      {mistakes.length === 0 ? (
        <p className={style.mutedText}>No mistakes in this scope.</p>
      ) : (
        <div className={style.mistakeTableScroll}>
          <table className={style.mistakeTable}>
            <thead>
              <tr className={style.mistakeTableHeadRow}>
                <th className={style.mistakeTableCheckboxHeadCell}></th>
                <th className={style.tableCell}>Roll</th>
                <th className={style.tableCell}>Detail</th>
                <th className={style.tableCell}>|Error|</th>
              </tr>
            </thead>
            <tbody>
              {mistakes.map((m) => (
                <tr
                  key={m.id}
                  onClick={() => onSelectRow(m.id)}
                  className={style.mistakeRow(m.id === selectedId)}
                >
                  <td className={style.tableCell}>
                    <input
                      type="checkbox"
                      checked={isTicked(m.id)}
                      onChange={() => toggle(m.id)}
                    />
                  </td>
                  <td className={style.tableCell}>
                    {m.roll.length > 0 ? (
                      <DiceRoll roll={m.roll} size={18} />
                    ) : (
                      <span className={style.mistakeTableNoRollText}>—</span>
                    )}
                  </td>
                  <td className={style.mistakeTableDetailCell}>
                    <MoveDelta
                      decision={m}
                      activeTab={m.id === selectedId ? moveTab : null}
                      onSelectTab={(tab) => onSelectRow(m.id, tab)}
                    />
                  </td>
                  <td className={style.mistakeTableErrorCell}>
                    {m.absError.toFixed(3)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function MistakesSection({ games }: { games: FetchedGame[] }) {
  const decisions = useMemo(() => extractDecisions(games), [games]);
  const playerOptions = useMemo(() => extractPlayerOptions(games), [games]);
  const gameIndexes = useMemo(() => extractGameIndexes(games), [games]);

  const [identities, setIdentities] = useState<PlayerIdentity[]>([]);
  const [selectedGame, setSelectedGame] = useState<"all" | number>("all");
  const [ticked, setTicked] = useState<Record<string, boolean>>({});
  const [selectedDecisionId, setSelectedDecisionId] = useState<string | null>(null);
  const [moveTab, setMoveTab] = useState<"my" | "best">("my");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/player-identities")
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled) setIdentities(json as PlayerIdentity[]);
      })
      .catch(() => {
        // Non-fatal — falls back to showing the raw userId below.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Resolve "which player is you" from PlayerIdentity instead of asking —
  // match a userId actually present in this match's decisions against a
  // known "isMe" identity, falling back to whichever userId shows up first
  // (never a hardcoded id) when there's no identity data to resolve against.
  const meIdentity = identities.find(
    (i) => i.isMe && playerOptions.some((p) => p.userId === i.sourceUserId)
  );
  const effectiveUserId = meIdentity?.sourceUserId ?? playerOptions[0]?.userId ?? null;

  const isTicked = (id: string) => ticked[id] !== false;
  const toggle = (id: string) =>
    setTicked((prev) => ({ ...prev, [id]: !isTicked(id) }));
  const setAll = (ids: string[], value: boolean) =>
    setTicked((prev) => {
      const next = { ...prev };
      for (const id of ids) next[id] = value;
      return next;
    });

  const scopedDecisions = useMemo(
    () =>
      decisions.filter(
        (d) =>
          d.userId === effectiveUserId &&
          (selectedGame === "all" || d.gameIndex === selectedGame)
      ),
    [decisions, effectiveUserId, selectedGame]
  );

  const checkerDecisions = scopedDecisions.filter((d) => d.kind === "checker");
  const cubeDecisions = scopedDecisions.filter((d) => d.kind === "cube");

  const checkerMistakes = checkerDecisions
    .filter((d) => d.isMistake)
    .sort((a, b) => b.absError - a.absError);
  const cubeMistakes = cubeDecisions
    .filter((d) => d.isMistake)
    .sort((a, b) => b.absError - a.absError);

  const checkerPR = computePR(checkerDecisions, isTicked);
  const cubePR = computePR(cubeDecisions, isTicked);
  const totalPR = combinePR(checkerPR, cubePR);

  const allMistakes = [...checkerMistakes, ...cubeMistakes].sort(
    (a, b) => b.absError - a.absError
  );
  const selected =
    allMistakes.find((m) => m.id === selectedDecisionId) ?? allMistakes[0] ?? null;

  function selectRow(id: string, tab: "my" | "best" = "my") {
    setSelectedDecisionId(id);
    setMoveTab(tab);
  }

  if (games.length === 0) return null;

  return (
    <div className={style.sectionWrapper}>
      <h2 className={style.sectionTitle}>
        Mistakes
      </h2>

      {playerOptions.length === 0 ? (
        <p className={style.mutedText}>
          No player data found in the fetched games.
        </p>
      ) : (
        <>
          {/* data-testid wrapper for e2e/board-visual.spec.ts's "mistakes-section"
              screenshot — the only reason this div exists at all (see PROGRESS.md's
              entry for its own justification). className exactly reproduces
              the outer container's flex-col gap-6 so wrapping these two
              previously-sibling blocks introduces zero visual change: they
              were 2 of 4 gap-6-spaced items in that flex column, now 1
              gap-6-spaced item containing its own gap-6-spaced pair —
              verified byte-for-byte via the visual suite, not just reasoned
              about. */}
          <div data-testid="mistakes-section" className={style.mistakesSectionChrome}>
            <div className={style.filtersRow}>
              <div className={style.filterGroup}>
                <span className={style.filterLabel}>You</span>
                <span className={style.filterValue}>
                  {meIdentity?.displayName ?? effectiveUserId ?? "—"}
                </span>
              </div>

              <div className={style.filterGroup}>
                <label htmlFor="game-select" className={style.filterLabel}>
                  Game
                </label>
                <select
                  id="game-select"
                  value={selectedGame}
                  onChange={(e) =>
                    setSelectedGame(e.target.value === "all" ? "all" : Number(e.target.value))
                  }
                  className={style.gameSelect}
                >
                  <option value="all">All games</option>
                  {gameIndexes.map((idx) => (
                    <option key={idx} value={idx}>
                      Game {idx}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className={style.prSummaryGrid}>
              <div className={style.prCard}>
                <p className={style.prCardLabel}>Total PR</p>
                <p className={style.prCardValue}>{formatPR(totalPR)}</p>
                <p className={style.prCardSubtext}>
                  {checkerPR.totalDecisions + cubePR.totalDecisions} decisions
                </p>
              </div>
              <div className={style.prCard}>
                <p className={style.prCardLabel}>Checker PR</p>
                <p className={style.prCardValue}>{formatPR(checkerPR.pr)}</p>
                <p className={style.prCardSubtext}>
                  {checkerPR.totalDecisions} decisions
                </p>
              </div>
              <div className={style.prCard}>
                <p className={style.prCardLabel}>Cube PR</p>
                <p className={style.prCardValue}>{formatPR(cubePR.pr)}</p>
                <p className={style.prCardSubtext}>
                  {cubePR.totalDecisions} decisions
                </p>
              </div>
            </div>
          </div>

          <div className={style.boardAndTablesRow}>
            <div className={style.boardColumn}>
              <BoardPanel selected={selected} moveTab={moveTab} />
            </div>

            <div className={style.tablesColumn}>
              <MistakeTable
                title="Checker mistakes"
                mistakes={checkerMistakes}
                isTicked={isTicked}
                toggle={toggle}
                setAll={setAll}
                selectedId={selected?.id ?? null}
                onSelectRow={selectRow}
                moveTab={moveTab}
              />

              <MistakeTable
                title="Cube mistakes"
                mistakes={cubeMistakes}
                isTicked={isTicked}
                toggle={toggle}
                setAll={setAll}
                selectedId={selected?.id ?? null}
                onSelectRow={selectRow}
                moveTab={moveTab}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
