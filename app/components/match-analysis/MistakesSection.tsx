"use client";

import { useMemo, useState } from "react";
import {
  combinePR,
  computePR,
  extractDecisions,
  extractGameIndexes,
  extractPlayerOptions,
  formatPR,
  partitionMistakes,
  scopeDecisions,
  type Decision,
  type FetchedGame,
} from "@/lib/mistakes";
import { resolveMyIdentity } from "@/lib/playerIdentity";
import { resolveSelected, type MoveTab } from "@/lib/listSelection";
import { useListSelection } from "@/app/hooks/useListSelection";
import { usePlayerIdentities } from "@/app/hooks/usePlayerIdentities";
import { useTickSet, type TickSet } from "@/app/hooks/useTickSet";
import BoardPanel from "./BoardPanel";
import DecisionList from "./DecisionList";
import { style } from "./MistakesSection.styles";

function PRCard({ label, pr, decisionCount }: { label: string; pr: number | null; decisionCount: number }) {
  return (
    <div className={style.prCard}>
      <p className={style.prCardLabel}>{label}</p>
      <p className={style.prCardValue}>{formatPR(pr)}</p>
      <p className={style.prCardSubtext}>
        {decisionCount} decisions
      </p>
    </div>
  );
}

function MistakeTable({
  title,
  mistakes,
  ticks,
  selectedId,
  onSelectRow,
  moveTab,
}: {
  title: string;
  mistakes: Decision[];
  ticks: TickSet;
  selectedId: string | null;
  onSelectRow: (id: string, tab?: MoveTab) => void;
  moveTab: MoveTab;
}) {
  const ids = mistakes.map((m) => m.id);

  return (
    <DecisionList
      rows={mistakes}
      title={title}
      emptyMessage="No mistakes in this scope."
      isSelected={(row) => row.id === selectedId}
      moveTab={moveTab}
      onSelectRow={(row, _index, tab) => onSelectRow(row.id, tab)}
      showRollColumn
      rollEmptyPlaceholder={<span className={style.mistakeTableNoRollText}>—</span>}
      showErrorColumn
      isChecked={(row) => ticks.isTicked(row.id)}
      onToggleCheck={(row) => ticks.toggle(row.id)}
      onSelectAll={() => ticks.setAll(ids, true)}
      onSelectNone={() => ticks.setAll(ids, false)}
    />
  );
}

export default function MistakesSection({ games }: { games: FetchedGame[] }) {
  const decisions = useMemo(() => extractDecisions(games), [games]);
  const playerOptions = useMemo(() => extractPlayerOptions(games), [games]);
  const gameIndexes = useMemo(() => extractGameIndexes(games), [games]);

  const identities = usePlayerIdentities();
  const [selectedGame, setSelectedGame] = useState<"all" | number>("all");
  const ticks = useTickSet();
  const {
    selectedKey: selectedDecisionId,
    moveTab,
    selectRow,
  } = useListSelection<string | null>(null);

  // Resolve "which player is you" from PlayerIdentity instead of asking
  // (same rule as the replay page — see lib/playerIdentity.ts), falling
  // back to whichever userId shows up first (never a hardcoded id) when
  // there's no identity data to resolve against.
  const meIdentity = resolveMyIdentity(
    identities,
    playerOptions.map((p) => p.userId)
  );
  const effectiveUserId = meIdentity?.sourceUserId ?? playerOptions[0]?.userId ?? null;

  const { checkerDecisions, cubeDecisions, checkerMistakes, cubeMistakes, allMistakes } = useMemo(
    () => partitionMistakes(scopeDecisions(decisions, effectiveUserId, selectedGame)),
    [decisions, effectiveUserId, selectedGame]
  );

  const checkerPR = computePR(checkerDecisions, ticks.isTicked);
  const cubePR = computePR(cubeDecisions, ticks.isTicked);
  const totalPR = combinePR(checkerPR, cubePR);

  const selected = resolveSelected(allMistakes, selectedDecisionId, (m) => m.id);

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
              <PRCard
                label="Total PR"
                pr={totalPR}
                decisionCount={checkerPR.totalDecisions + cubePR.totalDecisions}
              />
              <PRCard label="Checker PR" pr={checkerPR.pr} decisionCount={checkerPR.totalDecisions} />
              <PRCard label="Cube PR" pr={cubePR.pr} decisionCount={cubePR.totalDecisions} />
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
                ticks={ticks}
                selectedId={selected?.id ?? null}
                onSelectRow={selectRow}
                moveTab={moveTab}
              />

              <MistakeTable
                title="Cube mistakes"
                mistakes={cubeMistakes}
                ticks={ticks}
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
