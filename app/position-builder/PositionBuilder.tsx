"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { decodeForumPosition, forumPositionCaption } from "@/lib/forumPosition";
import { storeForumHandoff } from "@/app/forum/new/handoff";
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
import { pipCounts } from "@/lib/pipCount";
import Board, { type BoardCornerGuide } from "@/app/components/match-analysis/Board";
import PostToForumButton from "@/app/components/ui/PostToForumButton";
import Button from "@/app/components/ui/Button";
import Card from "@/app/components/ui/Card";
import { style } from "./positionBuilder.styles";
import type { Analysis, CubeAnalysis } from "@/lib/engine/gnubg";

type BuilderAnalysis = (
  | { kind: "checker"; analysis: Analysis }
  | { kind: "cube"; analysis: CubeAnalysis }
) & { inputKey: string };

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

// canPostToForum: isAppWriteEnabled(), decided by the server page (the forum
// write routes' gate). Off hides "Post to forum"; the builder still works.
// initialState / extraActions: optional, for other local tools that pre-fill
// the board and add their own buttons (app/snap-poc). Callers reset the
// builder by changing its React key.
// homeLeft: draw the board mirrored (point 1 bottom-left). Only the drawing
// changes: Board's hit areas use the same mirrored geometry and still report
// the logical point, so clicks edit the point drawn under the pointer.
// swapCheckerColors: draw each side in the other side's colours (Board's
// swapCheckerColors). Display only: the state, pips and sides don't change.
// showPips: off hides the pip counts in the caption (app/snap-poc's step 1,
// before the game is set). cornerGuide: Board's home board guide.
export default function PositionBuilder({
  canPostToForum,
  initialState,
  extraActions,
  homeLeft = false,
  swapCheckerColors = false,
  showPips = true,
  cornerGuide,
}: {
  canPostToForum: boolean;
  initialState?: PositionBuilderState;
  extraActions?: (state: PositionBuilderState) => ReactNode;
  homeLeft?: boolean;
  swapCheckerColors?: boolean;
  showPips?: boolean;
  cornerGuide?: BoardCornerGuide;
}) {
  const router = useRouter();
  const [state, setState] = useState<PositionBuilderState>(initialState ?? initialPositionBuilderState);
  const [editingSide, setEditingSide] = useState<Side>("mine");
  const [action, setAction] = useState<BuilderAction>("add");
  const [message, setMessage] = useState<string | null>(null);
  const [crawford, setCrawford] = useState(false);
  const [analysis, setAnalysis] = useState<BuilderAnalysis | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [engineUnavailable, setEngineUnavailable] = useState(false);
  const analysisInputKey = JSON.stringify([state, crawford]);
  const errors = useMemo(() => validateBuilderState(state), [state]);
  const pips = useMemo(() => pipCounts(state.position), [state.position]);
  const crawfordEligible = state.matchLength > 0 && state.score.some((score) => score === state.matchLength - 1);
  const cube: BoardCube =
    state.decisionType === "cube"
      ? { kind: "offered", value: state.cubeValue * 2, side: state.playerToMove }
      : { kind: "owned", value: state.cubeValue, owner: state.cubeOwner };
  const missing = [
    ...errors,
    ...(state.decisionType === "checker" && !state.roll ? ["Set both dice for the checker decision."] : []),
    ...(state.decisionType === "cube" && (crawford || (state.cubeOwner !== "center" && state.cubeOwner !== state.playerToMove))
      ? ["Cube analysis needs a centered cube or a cube owned by the doubling side, outside Crawford."]
      : []),
  ];

  async function analyzeBuilderPosition() {
    setAnalyzing(true);
    setAnalysis(null);
    setAnalysisError(null);
    try {
      const canonical = canonicalPositionForForum(state, crawford);
      const response = await fetch("/api/engine/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: state.decisionType,
          positionId: canonical.positionId,
          matchId: canonical.gnuMatchId,
          ...(state.decisionType === "checker" ? { dice: state.roll } : {}),
        }),
      });
      if (response.status === 503) {
        setEngineUnavailable(true);
        setAnalysisError(null);
        return;
      }
      if (!response.ok) throw new Error("GNU analysis could not be completed.");
      setAnalysis({ ...await response.json() as BuilderAnalysis, inputKey: JSON.stringify([state, crawford]) });
    } catch (error) {
      setAnalysisError(error instanceof Error ? error.message : "GNU analysis could not be completed.");
    } finally {
      setAnalyzing(false);
    }
  }

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

  function updateMatchLength(value: string) {
    setCrawford(false);
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
      const decoded = decodeForumPosition(canonical.positionId, canonical.gnuMatchId, canonical.kind);
      if (!decoded) throw new Error("The position is not valid.");
      const stored = storeForumHandoff({
        manual: canonical,
        preview: {
          position: decoded.position,
          cube: decoded.cube,
          dice: decoded.dice,
          caption: forumPositionCaption(decoded.match, canonical.kind),
        },
      });
      if (!stored) throw new Error("The board couldn't be handed off. Please allow session storage and try again.");
      router.push("/forum/new");
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
          <Board
            decoded={state.position}
            roll={state.decisionType === "checker" ? state.roll ?? [] : []}
            rollSide={state.playerToMove}
            cube={cube}
            homeLeft={homeLeft}
            swapCheckerColors={swapCheckerColors}
            cornerGuide={cornerGuide}
            onPointClick={(point) => edit(point)}
            onBarClick={(side) => {
              setEditingSide(side);
              edit("bar", side);
            }}
            onRollDieClick={(index) => updateDie(index as 0 | 1)}
          />
        </div>

        <div className={style.boardStatus}>
          <span className={style.sideCounts}>
            <span>
              Bottom <b className={style.counter}>{15 - state.position.mineOff}/15</b>
              {showPips && (
                <>
                  {" "}· Pips: <b className={style.counter}>{pips.mine}</b>
                </>
              )}
            </span>
            <span>
              Top <b className={style.counter}>{15 - state.position.opponentOff}/15</b>
              {showPips && (
                <>
                  {" "}· Pips: <b className={style.counter}>{pips.opponent}</b>
                </>
              )}
            </span>
          </span>
          <span>{sideLabel(state.playerToMove)} {state.decisionType} decision</span>
        </div>
      </Card>
        <Card as="section" className={style.controlCard} aria-labelledby="gnu-analysis-title">
          <h2 id="gnu-analysis-title" className={style.controlTitle}>GNU Backgammon 2-ply</h2>
          <p className={style.controlHint}>
            {sideLabel(state.playerToMove)} to move · Score {state.score[0]}–{state.score[1]} · {state.matchLength === 0 ? "Money game" : `${state.matchLength}-point match`}
          </p>
          {missing.length > 0 && <ul className={style.error}>{missing.map((item) => <li key={item}>{item}</li>)}</ul>}
          {analysisError && <p className={style.error} role="alert">{analysisError}</p>}
          {!engineUnavailable && (
            <Button variant="primary" disabled={missing.length > 0 || analyzing} onClick={analyzeBuilderPosition}>
              {analyzing ? "Analysing…" : "Analyse with GNU"}
            </Button>
          )}
          {analysis?.inputKey === analysisInputKey && analysis.kind === "checker" && (
            <div className={style.analysisList}>
              {analysis.analysis.candidates.length === 0 ? <p className={style.controlHint}>No legal moves</p> : analysis.analysis.candidates.slice(0, 4).map((candidate) => (
                <div key={`${candidate.rank}-${candidate.move}`} className={style.analysisRow}>
                  <span className={style.analysisMove}>{candidate.move}</span>
                  <span className={style.analysisEquity}>{candidate.equity >= 0 ? "+" : ""}{candidate.equity.toFixed(3)}</span>
                  <span className={style.controlHint}>{candidate.rank === 1 ? "best" : `−${(analysis.analysis.candidates[0].equity - candidate.equity).toFixed(3)}`}</span>
                  <span className={style.controlHint}>{candidate.plies === 0 && analysis.analysis.depthReason === "single-survivor" ? "0-ply · single survivor" : `${candidate.plies}-ply`}</span>
                </div>
              ))}
            </div>
          )}
          {analysis?.inputKey === analysisInputKey && analysis.kind === "cube" && (
            <div className={style.analysisList}>
              <p>{analysis.analysis.action}</p>
              <div className={style.analysisRow}><span>No double</span><b className={style.analysisEquity}>{analysis.analysis.equities.noDouble >= 0 ? "+" : ""}{analysis.analysis.equities.noDouble.toFixed(3)}</b></div>
              <div className={style.analysisRow}><span>Double / take</span><b className={style.analysisEquity}>{analysis.analysis.equities.doubleTake >= 0 ? "+" : ""}{analysis.analysis.equities.doubleTake.toFixed(3)}</b></div>
              <div className={style.analysisRow}><span>Double / pass</span><b className={style.analysisEquity}>{analysis.analysis.equities.doublePass >= 0 ? "+" : ""}{analysis.analysis.equities.doublePass.toFixed(3)}</b></div>
            </div>
          )}
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
                  className={style.segmentOption(editingSide === side)}
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
                  className={style.segmentOption(action === nextAction)}
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
                disabled={type === "cube" && crawford}
                className={style.segmentOption(state.decisionType === type, type === "cube" && crawford)}
                onClick={() => updateDecisionType(type)}
              >
                {type === "checker" ? "Checker decision" : "Cube decision"}
              </button>
            ))}
          </div>
          <div className={style.segmented} aria-label="Side to move">
            {(["mine", "opponent"] as const).map((side) => (
              <button key={side} type="button" aria-pressed={state.playerToMove === side}
                className={style.segmentOption(state.playerToMove === side)}
                onClick={() => setState((previous) => ({ ...previous, playerToMove: side }))}>
                {sideLabel(side)} to move
              </button>
            ))}
          </div>
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
          {state.decisionType === "checker" && (
            <Button variant="quiet" onClick={() => setState((previous) => ({ ...previous, roll: null }))}>Clear dice</Button>
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
                      setCrawford(false);
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
          {crawfordEligible && (
            <label className={style.field}>
              Crawford game
              <input type="checkbox" checked={crawford} onChange={(event) => {
                setCrawford(event.target.checked);
                if (event.target.checked) updateDecisionType("checker");
              }} />
            </label>
          )}
        </Card>
        {!crawford && state.decisionType === "cube" && (
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
        )}

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
              <b className={style.statValue(true)}>{state.position.mineOff}</b>
            </div>
            <div className={style.stat}>
              <span className={style.statLabel}>Top off</span>
              <b className={style.statValue(true)}>{state.position.opponentOff}</b>
            </div>
            <div className={style.stat}>
              <span className={style.statLabel}>Cube owner</span>
              <b className={style.statValue(false)}>{cubeOwnerLabel(state.cubeOwner)}</b>
            </div>
          </div>
        </Card>

        {canPostToForum && (
          <PostToForumButton onPost={postToForum} disabled={errors.length > 0} variant="primary" />
        )}
        {extraActions?.(state)}
      </div>
    </div>
  );
}
