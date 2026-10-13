"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { CubeOwner, Side } from "@/lib/boardGeometry";
import type { BoardCube } from "@/lib/boardFrame";
import {
  CUBE_VALUES,
  MATCH_LENGTHS,
  editChecker,
  emptyPosition,
  initialPositionBuilderState,
  normalizeRoll,
  validateBuilderState,
  canonicalPositionForForum,
  type BuilderAction,
  type BuilderLocation,
  type PositionBuilderState,
} from "@/lib/positionBuilder";
import Board from "@/app/components/match-analysis/Board";
import Button from "@/app/components/ui/Button";
import Card from "@/app/components/ui/Card";
import { style } from "./positionBuilder.styles";

function sideLabel(side: Side): string {
  return side === "mine" ? "Bottom" : "Top";
}

function cubeOwnerLabel(owner: CubeOwner): string {
  if (owner === "center") return "Center";
  return sideLabel(owner);
}

function numberValue(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
}

export default function PositionBuilder() {
  const router = useRouter();
  const [state, setState] = useState<PositionBuilderState>(initialPositionBuilderState);
  const [editingSide, setEditingSide] = useState<Side>("mine");
  const [action, setAction] = useState<BuilderAction>("add");
  const [message, setMessage] = useState<string | null>(null);
  const errors = useMemo(() => validateBuilderState(state), [state]);
  const cube: BoardCube = { kind: "owned", value: state.cubeValue, owner: state.cubeOwner };

  function edit(location: BuilderLocation, side = editingSide) {
    const result = editChecker(state.position, side, action, location);
    if (result.position === null) {
      setMessage(result.error);
      return;
    }
    setState((previous) => ({ ...previous, position: result.position }));
    setMessage(null);
  }

  function resetPosition(position: PositionBuilderState["position"]) {
    setState((previous) => ({ ...previous, position }));
    setMessage(null);
  }

  function updateDie(index: 0 | 1, value?: number) {
    setState((previous) => {
      const next: [number, number] = previous.roll ? [...previous.roll] : [1, 1];
      next[index] = value ?? (next[index] === 6 ? 1 : next[index] + 1);
      return { ...previous, roll: normalizeRoll(next) };
    });
  }

  // A checker decision needs a roll (keep the current one, or start at 1-1);
  // a cube decision has none.
  function updateDecisionType(type: PositionBuilderState["decisionType"]) {
    setState((previous) => ({
      ...previous,
      decisionType: type,
      roll: type === "checker" ? previous.roll ?? [1, 1] : null,
    }));
  }

  function toggleRollSide() {
    setState((previous) => ({
      ...previous,
      playerToMove: previous.playerToMove === "mine" ? "opponent" : "mine",
    }));
  }

  function updateMatchLength(value: string) {
    const matchLength = numberValue(value);
    setState((previous) => {
      const maximumScore = matchLength > 0 ? matchLength - 1 : Number.MAX_SAFE_INTEGER;
      return {
        ...previous,
        matchLength,
        score: [Math.min(previous.score[0], maximumScore), Math.min(previous.score[1], maximumScore)],
      };
    });
  }

  function updateCubeValue(value: string) {
    const cubeValue = numberValue(value);
    setState((previous) => ({
      ...previous,
      cubeValue,
      cubeOwner: cubeValue === 1 ? "center" : previous.cubeOwner === "center" ? "mine" : previous.cubeOwner,
    }));
  }

  function updateCubeOwner(owner: CubeOwner) {
    setState((previous) => ({
      ...previous,
      cubeOwner: owner,
      cubeValue: owner === "center" ? 1 : previous.cubeValue === 1 ? 2 : previous.cubeValue,
    }));
  }

  function postToForum() {
    try {
      const canonical = canonicalPositionForForum(state);
      const query = new URLSearchParams({
        positionId: canonical.positionId,
        gnuMatchId: canonical.gnuMatchId,
        kind: canonical.kind,
      });
      router.push(`/forum/new?${query.toString()}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The position is not valid.");
    }
  }

  return (
    <div className={style.workspace}>
      <Card as="section" className={style.boardCard} aria-labelledby="position-builder-board-title">
        <div className={style.boardHeader}>
          <div>
            <p className={style.overline}>Editable position</p>
            <h2 id="position-builder-board-title" className={style.boardTitle}>
              Build the board
            </h2>
            <p className={style.boardDescription}>
              Choose a side and an action, then click a point or bar. Changes stay in this browser tab and are not saved yet.
            </p>
          </div>
          <div className={style.inlineActions}>
            <Button variant="secondary" size="compact" onClick={() => resetPosition(initialPositionBuilderState().position)}>
              Starting position
            </Button>
            <Button variant="secondary" size="compact" onClick={() => resetPosition(emptyPosition())}>
              Clear board
            </Button>
          </div>
        </div>

        <div className={style.boardWrap}>
          <div className={style.boardViewport}>
            <Board
              decoded={state.position}
              roll={state.decisionType === "checker" ? state.roll ?? [] : []}
              rollSide={state.playerToMove}
              cube={cube}
              onPointClick={(point) => edit(point)}
              onBarClick={(side) => {
                setEditingSide(side);
                edit("bar", side);
              }}
              onRollDieClick={(index) => updateDie(index as 0 | 1)}
            />
          </div>
        </div>

        <div className={style.boardStatus}>
          <span>
            Bottom <b className={style.counter}>{15 - state.position.mineOff}/15</b> · Top{" "}
            <b className={style.counter}>{15 - state.position.opponentOff}/15</b>
          </span>
          <span>{sideLabel(state.playerToMove)} {state.decisionType} decision</span>
        </div>
      </Card>

      <div className={style.controls}>
        <Card as="section" className={style.controlCard} aria-labelledby="position-builder-edit-title">
          <div>
            <h2 id="position-builder-edit-title" className={style.controlTitle}>Checker placement</h2>
            <p className={style.controlHint}>The bottom and top sides each have 15 checkers, including the bar and borne-off count.</p>
          </div>

          <fieldset className={style.fieldset}>
            <legend className={style.legend}>Side</legend>
            <div className={style.segmented}>
              {(["mine", "opponent"] as const).map((side) => (
                <button
                  key={side}
                  type="button"
                  aria-pressed={editingSide === side}
                  className={style.sideOption(editingSide === side)}
                  onClick={() => setEditingSide(side)}
                >
                  {sideLabel(side)}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className={style.fieldset}>
            <legend className={style.legend}>Action</legend>
            <div className={style.segmented}>
              {(["add", "remove"] as const).map((nextAction) => (
                <button
                  key={nextAction}
                  type="button"
                  aria-pressed={action === nextAction}
                  className={style.actionOption(action === nextAction)}
                  onClick={() => setAction(nextAction)}
                >
                  {nextAction === "add" ? "Add checker" : "Remove checker"}
                </button>
              ))}
            </div>
          </fieldset>

          {message && <p className={style.error} role="alert">{message}</p>}
        </Card>

        <Card as="section" className={style.controlCard} aria-labelledby="position-builder-match-title">
          <h2 id="position-builder-match-title" className={style.controlTitle}>Match context</h2>

          <p className={style.controlHint}>
            Choose the decision mode. Checker decisions show a centered roll; cube decisions have no roll.
          </p>
          <div className={style.segmented}>
            {(["checker", "cube"] as const).map((type) => (
              <button
                key={type}
                type="button"
                aria-pressed={state.decisionType === type}
                className={style.actionOption(state.decisionType === type)}
                onClick={() => updateDecisionType(type)}
              >
                {type === "checker" ? "Checker decision" : "Cube decision"}
              </button>
            ))}
          </div>
          <Button variant="secondary" size="compact" onClick={toggleRollSide}>
            Switch decision side ({sideLabel(state.playerToMove)})
          </Button>
          {state.decisionType === "checker" && (
            <div className={style.fieldGrid}>
              {[0, 1].map((index) => (
                <label key={index} className={style.field}>
                  Die {index + 1}
                  <select
                    className={style.select}
                    value={state.roll?.[index] ?? 1}
                    onChange={(event) => updateDie(index as 0 | 1, numberValue(event.target.value))}
                  >
                    {[1, 2, 3, 4, 5, 6].map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          )}

          <fieldset className={style.fieldset}>
            <legend className={style.legend}>Score</legend>
            <div className={style.fieldGrid}>
              {(["Bottom", "Top"] as const).map((label, index) => (
                <label key={label} className={style.field}>
                  {label}
                  <input
                    className={style.inputCompact}
                    type="number"
                    min={0}
                    max={state.matchLength > 0 ? state.matchLength - 1 : undefined}
                    value={state.score[index]}
                    onChange={(event) => {
                      const score = numberValue(event.target.value);
                      setState((previous) => {
                        const next: [number, number] = [...previous.score];
                        next[index] = score;
                        return { ...previous, score: next };
                      });
                    }}
                  />
                </label>
              ))}
            </div>
          </fieldset>

          <label className={style.field}>
            Match length
            <select
              className={style.select}
              value={state.matchLength}
              onChange={(event) => updateMatchLength(event.target.value)}
            >
              {MATCH_LENGTHS.map((length) => (
                <option key={length} value={length}>
                  {length === 0 ? "Money game" : `${length}-point match`}
                </option>
              ))}
            </select>
          </label>
        </Card>

        <Card as="section" className={style.controlCard} aria-labelledby="position-builder-cube-title">
          <h2 id="position-builder-cube-title" className={style.controlTitle}>Doubling cube</h2>
          <div className={style.fieldGrid}>
            <label className={style.field}>
              Value
              <select
                className={style.select}
                value={state.cubeValue}
                onChange={(event) => updateCubeValue(event.target.value)}
              >
                {CUBE_VALUES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <label className={style.field}>
              Owner
              <select
                className={style.select}
                value={state.cubeOwner}
                onChange={(event) => updateCubeOwner(event.target.value as CubeOwner)}
              >
                {(["center", "mine", "opponent"] as const).map((owner) => (
                  <option key={owner} value={owner}>
                    {cubeOwnerLabel(owner)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className={style.controlHint}>A cube at 1 is centered. A cube above 1 must belong to Bottom or Top.</p>
        </Card>

        <Card as="section" className={style.controlCard} aria-labelledby="position-builder-status-title">
          <h2 id="position-builder-status-title" className={style.controlTitle}>Position status</h2>
          {errors.length > 0 ? (
            <ul className={style.error}>
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          ) : (
            <p className={style.valid}>The checker counts and match metadata are internally valid.</p>
          )}
          <div className={style.statList}>
            <div className={style.stat}>
              <span className={style.statLabel}>Bottom off</span>
              <b className={style.statValue}>{state.position.mineOff}</b>
            </div>
            <div className={style.stat}>
              <span className={style.statLabel}>Top off</span>
              <b className={style.statValue}>{state.position.opponentOff}</b>
            </div>
            <div className={style.stat}>
              <span className={style.statLabel}>Cube owner</span>
              <b className={style.statValue}>{cubeOwnerLabel(state.cubeOwner)}</b>
            </div>
          </div>
          <p className={style.footerNote}>Save and analysis are intentionally not connected yet.</p>
        </Card>

        <Button variant="primary" onClick={postToForum} disabled={errors.length > 0}>
          Post to forum
        </Button>
      </div>
    </div>
  );
}
