"use client";

import { useMemo, useState } from "react";
import type { Decision } from "@/lib/mistakes";
import { decodeGnuPositionId } from "@/lib/gnuPositionId";
import { parseNotation } from "@/lib/backgammonNotation";
import Board from "./Board";

function severityDot(severity: "error" | "blunder" | null) {
  if (!severity) return null;
  const color = severity === "blunder" ? "bg-red-500" : "bg-amber-500";
  return <span className={`inline-block h-2 w-2 rounded-full ${color}`} aria-hidden />;
}

function MistakeListGroup({
  title,
  mistakes,
  selectedId,
  onSelect,
}: {
  title: string;
  mistakes: Decision[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {title}
      </h4>
      {mistakes.length === 0 ? (
        <p className="text-xs text-zinc-400 dark:text-zinc-500">None in this scope.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {mistakes.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => onSelect(m.id)}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors ${
                  selectedId === m.id
                    ? "bg-foreground text-background"
                    : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
                }`}
              >
                {severityDot(m.severity)}
                <span className="shrink-0 font-mono opacity-70">G{m.gameIndex}</span>
                <span className="truncate font-mono">{m.detail}</span>
                <span className="ml-auto shrink-0 font-mono">{m.absError.toFixed(3)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function BoardPanel({
  checkerMistakes,
  cubeMistakes,
}: {
  checkerMistakes: Decision[];
  cubeMistakes: Decision[];
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [moveTab, setMoveTab] = useState<"my" | "best">("my");

  const allMistakes = useMemo(
    () => [...checkerMistakes, ...cubeMistakes],
    [checkerMistakes, cubeMistakes]
  );

  const selected =
    allMistakes.find((m) => m.id === selectedId) ?? allMistakes[0] ?? null;

  const decoded = useMemo(() => {
    if (!selected?.sourcePositionId) return null;
    try {
      return decodeGnuPositionId(selected.sourcePositionId);
    } catch {
      return null;
    }
  }, [selected]);

  const notation =
    selected?.kind === "checker"
      ? moveTab === "my"
        ? selected.myMoveNotation
        : selected.bestMoveNotation
      : null;

  const subMoves = useMemo(() => (notation ? parseNotation(notation) : []), [notation]);

  function selectMistake(id: string) {
    setSelectedId(id);
    setMoveTab("my");
  }

  if (allMistakes.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-black dark:text-zinc-50">Board</h3>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No mistakes in this scope to show on the board.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-black dark:text-zinc-50">Board</h3>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="flex flex-1 flex-col items-center gap-3 rounded-lg border border-black/10 bg-white p-4 dark:border-white/15 dark:bg-zinc-900">
          {selected?.kind === "checker" && (
            <div className="inline-flex w-fit rounded-full border border-black/10 bg-zinc-50 p-1 dark:border-white/15 dark:bg-zinc-950">
              <button
                type="button"
                onClick={() => setMoveTab("my")}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  moveTab === "my"
                    ? "bg-foreground text-background"
                    : "text-zinc-600 dark:text-zinc-400"
                }`}
              >
                My move
              </button>
              <button
                type="button"
                onClick={() => setMoveTab("best")}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  moveTab === "best"
                    ? "bg-foreground text-background"
                    : "text-zinc-600 dark:text-zinc-400"
                }`}
              >
                Best move
              </button>
            </div>
          )}

          {decoded ? (
            <Board decoded={decoded} subMoves={subMoves} />
          ) : (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              No position data for this decision.
            </p>
          )}

          {selected && (
            <p className="text-center text-xs text-zinc-600 dark:text-zinc-400">
              Game {selected.gameIndex} · {selected.detail} · |error| {selected.absError.toFixed(3)}
            </p>
          )}
        </div>

        <div className="flex w-full flex-col gap-4 rounded-lg border border-black/10 bg-white p-3 dark:border-white/15 dark:bg-zinc-900 lg:w-64 lg:max-h-[520px] lg:overflow-y-auto">
          <MistakeListGroup
            title="Checker"
            mistakes={checkerMistakes}
            selectedId={selected?.id ?? null}
            onSelect={selectMistake}
          />
          <MistakeListGroup
            title="Cube"
            mistakes={cubeMistakes}
            selectedId={selected?.id ?? null}
            onSelect={selectMistake}
          />
        </div>
      </div>
    </div>
  );
}
