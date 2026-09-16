"use client";

import { useMemo, useState } from "react";
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

function formatPR(pr: number | null): string {
  return pr === null ? "—" : pr.toFixed(2);
}

function severityBadge(severity: "error" | "blunder") {
  const classes =
    severity === "blunder"
      ? "border-red-300 bg-red-100 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300"
      : "border-amber-300 bg-amber-100 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300";
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${classes}`}>
      {severity}
    </span>
  );
}

function MistakeTable({
  title,
  mistakes,
  isTicked,
  toggle,
  setAll,
}: {
  title: string;
  mistakes: Decision[];
  isTicked: (id: string) => boolean;
  toggle: (id: string) => void;
  setAll: (ids: string[], value: boolean) => void;
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
          <table className="w-full min-w-[480px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-black/10 bg-zinc-100 text-xs uppercase tracking-wide text-zinc-500 dark:border-white/15 dark:bg-zinc-900 dark:text-zinc-400">
                <th className="w-8 px-3 py-2"></th>
                <th className="px-3 py-2">Game</th>
                <th className="px-3 py-2">Detail</th>
                <th className="px-3 py-2">|Error|</th>
                <th className="px-3 py-2">Severity</th>
              </tr>
            </thead>
            <tbody>
              {mistakes.map((m) => (
                <tr
                  key={m.id}
                  className="border-b border-black/5 last:border-b-0 dark:border-white/10"
                >
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={isTicked(m.id)}
                      onChange={() => toggle(m.id)}
                    />
                  </td>
                  <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">{m.gameIndex}</td>
                  <td className="px-3 py-2 font-mono text-xs text-black dark:text-zinc-100">
                    {m.detail}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-black dark:text-zinc-100">
                    {m.absError.toFixed(3)}
                  </td>
                  <td className="px-3 py-2">{m.severity && severityBadge(m.severity)}</td>
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

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedGame, setSelectedGame] = useState<"all" | number>("all");
  const [ticked, setTicked] = useState<Record<string, boolean>>({});

  const effectiveUserId = selectedUserId ?? playerOptions[0]?.userId ?? null;

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
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Which player is you?
              </span>
              <div className="flex flex-wrap gap-3">
                {playerOptions.map((p) => (
                  <label
                    key={p.key}
                    className="flex items-center gap-1.5 text-sm text-black dark:text-zinc-100"
                  >
                    <input
                      type="radio"
                      name="player"
                      checked={effectiveUserId === p.userId}
                      onChange={() => setSelectedUserId(p.userId)}
                    />
                    {p.userId}
                    {p.color && <span className="text-zinc-500 dark:text-zinc-400"> ({p.color})</span>}
                  </label>
                ))}
              </div>
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
            </div>
            <div className="rounded-lg border border-black/10 bg-white p-4 dark:border-white/15 dark:bg-zinc-900">
              <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Checker PR</p>
              <p className="mt-1 text-2xl font-semibold text-black dark:text-zinc-50">{formatPR(checkerPR.pr)}</p>
            </div>
            <div className="rounded-lg border border-black/10 bg-white p-4 dark:border-white/15 dark:bg-zinc-900">
              <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Cube PR</p>
              <p className="mt-1 text-2xl font-semibold text-black dark:text-zinc-50">{formatPR(cubePR.pr)}</p>
            </div>
          </div>

          <MistakeTable
            title="Checker mistakes"
            mistakes={checkerMistakes}
            isTicked={isTicked}
            toggle={toggle}
            setAll={setAll}
          />

          <MistakeTable
            title="Cube mistakes"
            mistakes={cubeMistakes}
            isTicked={isTicked}
            toggle={toggle}
            setAll={setAll}
          />

          <BoardPanel checkerMistakes={checkerMistakes} cubeMistakes={cubeMistakes} />
        </>
      )}
    </div>
  );
}
