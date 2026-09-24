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
  const myColor =
    decision.severity === "blunder"
      ? "text-red-600 dark:text-red-400"
      : "text-amber-600 dark:text-amber-400";

  return (
    <span className="whitespace-nowrap">
      <span
        className={`cursor-pointer font-semibold ${myColor} ${
          activeTab === "my" ? "underline" : "hover:underline"
        }`}
        onClick={(e) => {
          e.stopPropagation();
          onSelectTab?.("my");
        }}
      >
        {decision.myLabel}
      </span>
      <span
        className={`ml-1.5 cursor-pointer font-semibold text-green-600 dark:text-green-400 ${
          activeTab === "best" ? "underline" : "hover:underline"
        }`}
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
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-black dark:text-zinc-50">{title}</h3>
        <div className="flex gap-2 text-xs">
          <button
            type="button"
            onClick={() => setAll(ids, true)}
            className="text-zinc-600 underline hover:text-black dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            Select all
          </button>
          <button
            type="button"
            onClick={() => setAll(ids, false)}
            className="text-zinc-600 underline hover:text-black dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            Select none
          </button>
        </div>
      </div>

      {mistakes.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">No mistakes in this scope.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/15">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-black/10 bg-zinc-100 text-xs uppercase tracking-wide text-zinc-500 dark:border-white/15 dark:bg-zinc-900 dark:text-zinc-400">
                <th className="w-8 px-3 py-2"></th>
                <th className="px-3 py-2">Roll</th>
                <th className="px-3 py-2">Detail</th>
                <th className="px-3 py-2">|Error|</th>
              </tr>
            </thead>
            <tbody>
              {mistakes.map((m) => (
                <tr
                  key={m.id}
                  onClick={() => onSelectRow(m.id)}
                  className={`cursor-pointer border-b border-black/5 last:border-b-0 dark:border-white/10 ${
                    m.id === selectedId
                      ? "bg-blue-50 ring-1 ring-inset ring-blue-400 dark:bg-blue-950/40 dark:ring-blue-500"
                      : "hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                  }`}
                >
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={isTicked(m.id)}
                      onChange={() => toggle(m.id)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    {m.roll.length > 0 ? (
                      <DiceRoll roll={m.roll} size={18} />
                    ) : (
                      <span className="text-xs text-zinc-400 dark:text-zinc-600">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">
                    <MoveDelta
                      decision={m}
                      activeTab={m.id === selectedId ? moveTab : null}
                      onSelectTab={(tab) => onSelectRow(m.id, tab)}
                    />
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-black dark:text-zinc-100">
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
    <div className="flex flex-col gap-6 border-t border-black/10 pt-8 dark:border-white/15">
      <h2 className="text-xl font-semibold tracking-tight text-black dark:text-zinc-50">
        Mistakes
      </h2>

      {playerOptions.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No player data found in the fetched games.
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">You</span>
              <span className="text-sm text-black dark:text-zinc-100">
                {meIdentity?.displayName ?? effectiveUserId ?? "—"}
              </span>
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="game-select" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Game
              </label>
              <select
                id="game-select"
                value={selectedGame}
                onChange={(e) =>
                  setSelectedGame(e.target.value === "all" ? "all" : Number(e.target.value))
                }
                className="rounded-lg border border-black/10 bg-white px-3 py-1.5 text-sm text-black outline-none focus:border-black/30 dark:border-white/15 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-white/30"
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

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-black/10 bg-white p-4 dark:border-white/15 dark:bg-zinc-900">
              <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Total PR</p>
              <p className="mt-1 text-2xl font-semibold text-black dark:text-zinc-50">{formatPR(totalPR)}</p>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                {checkerPR.totalDecisions + cubePR.totalDecisions} decisions
              </p>
            </div>
            <div className="rounded-lg border border-black/10 bg-white p-4 dark:border-white/15 dark:bg-zinc-900">
              <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Checker PR</p>
              <p className="mt-1 text-2xl font-semibold text-black dark:text-zinc-50">{formatPR(checkerPR.pr)}</p>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                {checkerPR.totalDecisions} decisions
              </p>
            </div>
            <div className="rounded-lg border border-black/10 bg-white p-4 dark:border-white/15 dark:bg-zinc-900">
              <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Cube PR</p>
              <p className="mt-1 text-2xl font-semibold text-black dark:text-zinc-50">{formatPR(cubePR.pr)}</p>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                {cubePR.totalDecisions} decisions
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
            <div className="flex-1 lg:min-w-0">
              <BoardPanel selected={selected} moveTab={moveTab} />
            </div>

            <div className="flex w-full flex-col gap-6 lg:max-h-[80vh] lg:w-[380px] lg:shrink-0 lg:overflow-y-auto">
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
