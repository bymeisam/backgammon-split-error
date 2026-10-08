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
import { formatLoss } from "@/lib/review/format";
import { attachNotes } from "@/lib/decisionNotes";
import { resolveSelected, type MoveTab } from "@/lib/listSelection";
import { useListSelection } from "@/app/hooks/useListSelection";
import { useMoveTableKeys } from "@/app/hooks/useMoveTableKeys";
import { stepIndex } from "@/lib/moveTableKeys";
import { usePlayerIdentities } from "@/app/hooks/usePlayerIdentities";
import { useMatchDecisionNotes } from "@/app/hooks/useMatchDecisionNotes";
import { useTickSet, type TickSet } from "@/app/hooks/useTickSet";
import BoardPanel from "./BoardPanel";
import DecisionList from "./DecisionList";
import { style } from "./MistakesSection.styles";

// One cell of the PR stat card.
function PRStat({ label, pr, decisionCount }: { label: string; pr: number | null; decisionCount: number }) {
  return (
    <div className={style.statCell}>
      <p className={style.statLabel}>{label}</p>
      <p className={style.statValue}>{formatPR(pr)}</p>
      <p className={style.statMeta}>{decisionCount} decisions</p>
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
  bleed,
}: {
  title: string;
  mistakes: Decision[];
  ticks: TickSet;
  selectedId: string | null;
  onSelectRow: (id: string, tab?: MoveTab) => void;
  moveTab: MoveTab;
  bleed: boolean;
}) {
  const ids = mistakes.map((m) => m.id);

  return (
    <DecisionList
      rows={mistakes}
      title={title}
      headEnd={
        <span className={style.selectActions}>
          <button type="button" onClick={() => ticks.setAll(ids, true)} className={style.selectButton}>
            Select all
          </button>
          <button type="button" onClick={() => ticks.setAll(ids, false)} className={style.selectButton}>
            Select none
          </button>
        </span>
      }
      emptyMessage="No mistakes in this scope."
      isSelected={(row) => row.id === selectedId}
      moveTab={moveTab}
      onSelectRow={(row, _index, tab) => onSelectRow(row.id, tab)}
      columns="match"
      rollEmptyPlaceholder={<span className={style.mistakeTableNoRollText}>—</span>}
      isChecked={(row) => ticks.isTicked(row.id)}
      onToggleCheck={(row) => ticks.toggle(row.id)}
      renderTrailing={(row) => <span className={style.loss}>{formatLoss(-row.absError)}</span>}
      bleed={bleed}
    />
  );
}

export default function MistakesSection({
  matchId,
  games,
  bleed = false,
}: {
  // Galaxy's match id (Match.sourceMatchId) — used only to look up this
  // match's notes in the DB. Omitted on /galaxy/matches/[matchId]: that page
  // shows live Galaxy data and is read-only, so it gets no notes at all (no
  // fetch, no note UI — DecisionNote renders nothing without a dbDecisionId).
  matchId?: string;
  games: FetchedGame[];
  // The page has no side padding below md (/matches/[matchId]); the blocks
  // inset themselves.
  bleed?: boolean;
}) {
  // Decisions here are built from game payloads (no DB ids), so notes and
  // the real Decision.id come from one per-match lookup, matched on
  // (gameIndex, eventId). A match that isn't in the DB gets none, and so
  // does a caller that passes no matchId (useMatchDecisionNotes skips the
  // fetch and returns empty).
  const matchNotes = useMatchDecisionNotes(matchId);
  const decisions = useMemo(
    () => attachNotes(extractDecisions(games), matchNotes.decisions),
    [games, matchNotes.decisions]
  );
  const playerOptions = useMemo(() => extractPlayerOptions(games), [games]);
  const gameIndexes = useMemo(() => extractGameIndexes(games), [games]);

  const identities = usePlayerIdentities();
  const [selectedGame, setSelectedGame] = useState<"all" | number>("all");
  const ticks = useTickSet();
  const {
    selectedKey: selectedDecisionId,
    moveTab,
    selectRow,
    setMoveTab,
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

  // ↓/j and ↑/k walk the two lists in the order they're shown (the checker
  // mistakes, then the cube mistakes), stopping at either end; ←/h and →/l
  // switch the board between the played and the best move, as clicking a
  // row's move or its "best …" line does (lib/moveTableKeys.ts).
  const rowsInListOrder = useMemo(() => [...checkerMistakes, ...cubeMistakes], [checkerMistakes, cubeMistakes]);
  useMoveTableKeys("list", (action) => {
    if (action === "my" || action === "best") {
      if (!selected) return false;
      setMoveTab(action);
      return true;
    }
    if (action !== "next" && action !== "prev") return false;
    const current = selected ? rowsInListOrder.indexOf(selected) : -1;
    const target = stepIndex(current, rowsInListOrder.length, action === "next" ? 1 : -1);
    if (target === null) return false;
    selectRow(rowsInListOrder[target].id);
    return true;
  });

  if (games.length === 0) return null;

  return (
    <div className={style.sectionWrapper}>
      {playerOptions.length === 0 ? (
        <p className={style.mutedText(bleed)}>No player data found in the fetched games.</p>
      ) : (
        <>
          {/* data-testid wrapper for e2e/board-visual.spec.ts's
              "mistakes-section" screenshot: the PR stat card and the
              section head with its Game select. */}
          <div data-testid="mistakes-section" className={style.mistakesSectionChrome}>
            <div className={style.statCard(bleed)}>
              <PRStat
                label="Total PR"
                pr={totalPR}
                decisionCount={checkerPR.totalDecisions + cubePR.totalDecisions}
              />
              <PRStat label="Checker PR" pr={checkerPR.pr} decisionCount={checkerPR.totalDecisions} />
              <PRStat label="Cube PR" pr={cubePR.pr} decisionCount={cubePR.totalDecisions} />
            </div>

            <div className={style.sectionHead(bleed)}>
              <h2 className={style.sectionTitle}>Mistakes</h2>
              <label htmlFor="game-select" className={style.gameField}>
                <span className={style.srOnly}>Game</span>
                <select
                  id="game-select"
                  value={selectedGame}
                  onChange={(e) => setSelectedGame(e.target.value === "all" ? "all" : Number(e.target.value))}
                  className={style.gameSelect}
                >
                  <option value="all">All games</option>
                  {gameIndexes.map((idx) => (
                    <option key={idx} value={idx}>
                      Game {idx}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className={style.layout}>
            <div className={style.boardColumn}>
              {selected && <p className={style.contextLine(bleed)}>Game {selected.gameIndex}</p>}
              <BoardPanel selected={selected} moveTab={moveTab} canEditNotes={matchNotes.canEdit} bleed={bleed} />
            </div>

            <div className={style.listsColumn}>
              <MistakeTable
                title="Checker mistakes"
                mistakes={checkerMistakes}
                ticks={ticks}
                selectedId={selected?.id ?? null}
                onSelectRow={selectRow}
                moveTab={moveTab}
                bleed={bleed}
              />

              <MistakeTable
                title="Cube mistakes"
                mistakes={cubeMistakes}
                ticks={ticks}
                selectedId={selected?.id ?? null}
                onSelectRow={selectRow}
                moveTab={moveTab}
                bleed={bleed}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
