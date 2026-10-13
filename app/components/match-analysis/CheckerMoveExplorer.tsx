"use client";

import { useMemo, useRef, useState } from "react";
import type { BoardCube } from "@/lib/boardFrame";
import {
  checkerMoveStatus,
  createCheckerExplorer,
  legalHops,
  playCheckerHop,
  resetCheckerExplorer,
  undoCheckerHop,
  type CheckerHop,
  type CheckerLocation,
} from "@/lib/checkerMoves";
import type { DecodedPosition } from "@/lib/gnuPositionId";
import Board, { type BoardHighlight } from "./Board";
import Button from "../ui/Button";
import { style } from "./CheckerMoveExplorer.styles";

type SelectedLocation = CheckerLocation | null;

function locationLabel(location: CheckerLocation): string {
  return location === "bar" ? "bar" : `point ${location}`;
}

function destinationLabel(hop: CheckerHop): string {
  if (hop.to === "off") return `Bear off from point ${hop.from} using die ${hop.die}`;
  return `Move from ${locationLabel(hop.from)} to point ${hop.to} with die ${hop.die}${hop.hit ? ", hitting a checker" : ""}`;
}

function sameLocation(left: SelectedLocation, right: CheckerLocation): boolean {
  return left === right;
}

export default function CheckerMoveExplorer({
  position,
  dice,
  cube = null,
}: {
  position: DecodedPosition;
  dice: number[];
  cube?: BoardCube | null;
}) {
  const [state, setState] = useState(() => createCheckerExplorer(position, dice));
  const [selected, setSelected] = useState<SelectedLocation>(null);
  const suppressClick = useRef(false);
  const available = useMemo(() => legalHops(state.position, state.remainingDice), [state.position, state.remainingDice]);
  const selectedHops = selected === null ? [] : available.filter((hop) => sameLocation(hop.from, selected));
  const status = checkerMoveStatus(state);
  const chooseHop = (hop: CheckerHop) => {
    setState((current) => playCheckerHop(current, hop));
    setSelected(null);
  };
  const preferredHop = (location: CheckerLocation): CheckerHop | undefined =>
    available
      .filter((hop) => sameLocation(hop.from, location))
      .sort((left, right) => right.die - left.die)[0];

  const selectPoint = (point: number) => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    const destination = selectedHops.find((hop) => hop.to === point);
    if (destination) {
      chooseHop(destination);
      return;
    }
    const source = preferredHop(point);
    if (source) chooseHop(source);
  };

  const selectBar = () => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    const source = preferredHop("bar");
    if (source) chooseHop(source);
  };

  const selectPointByKeyboard = (point: number) => {
    const destination = selectedHops.find((hop) => hop.to === point);
    if (destination) {
      chooseHop(destination);
      return;
    }
    if (available.some((hop) => hop.from === point)) setSelected(point);
  };

  const selectBarByKeyboard = () => {
    if (available.some((hop) => hop.from === "bar")) setSelected("bar");
  };

  const beginPointerSelection = (location: CheckerLocation) => {
    if (available.some((hop) => sameLocation(hop.from, location))) setSelected(location);
  };

  const endPointerSelection = (location: CheckerLocation) => {
    if (selected === null) return;
    const destination = selectedHops.find((hop) => hop.to === location);
    if (!destination) return;
    chooseHop(destination);
    suppressClick.current = true;
  };

  const cancelPointerSelection = () => setSelected(null);

  const reset = () => {
    setState((current) => resetCheckerExplorer(current));
    setSelected(null);
  };

  const undo = () => {
    setState((current) => undoCheckerHop(current));
    setSelected(null);
  };

  const pointHighlight = (point: number): BoardHighlight | undefined => {
    if (selected === point) return "selected";
    if (selectedHops.some((hop) => hop.to === point)) return "destination";
    if (available.some((hop) => hop.from === point)) return "source";
    return undefined;
  };

  const pointLabel = (point: number): string => {
    if (selectedHops.some((hop) => hop.to === point)) return `Move checker to point ${point}`;
    if (available.some((hop) => hop.from === point)) return `Select checker on point ${point}`;
    return `Point ${point}, no legal move`;
  };

  const barHighlight = (): BoardHighlight | undefined => {
    if (selected === "bar") return "selected";
    if (available.some((hop) => hop.from === "bar")) return "source";
    return undefined;
  };

  const statusClassName =
    status === "complete" ? style.statusComplete : status === "no-legal-move" ? style.statusNoMove : style.status;
  // The move built so far ("6/2 4/off"), and the dice still to play ("6-4",
  // then "6"): they replace a Used/Remaining readout in the status row.
  const notation = state.hops.map((hop) => `${hop.from}/${hop.to}${hop.hit ? "*" : ""}`).join(" ");
  const toPlay = status === "ready" && state.remainingDice.length > 0 ? `${state.remainingDice.join("-")} to play` : null;

  return (
    <div className={style.explorer}>
      <div className={style.boardViewport}>
        <Board
          decoded={state.position}
          roll={state.dice}
          rollSide="mine"
          cube={cube}
          onPointKeyDown={selectPointByKeyboard}
          onBarKeyDown={selectBarByKeyboard}
          onPointClick={selectPoint}
          onBarClick={selectBar}
          onPointPointerDown={beginPointerSelection}
          onPointPointerUp={endPointerSelection}
          onPointPointerCancel={cancelPointerSelection}
          onBarPointerDown={() => beginPointerSelection("bar")}
          onBarPointerUp={() => endPointerSelection("bar")}
          onBarPointerCancel={cancelPointerSelection}
          interactiveBarSides={["mine"]}
          interactivePointEnabled={(point) =>
            selected === point ||
            available.some((hop) => hop.from === point) ||
            (selected !== null && selectedHops.some((hop) => hop.to === point))
          }
          interactiveBarEnabled={(side) =>
            side === "mine" && (selected === "bar" || available.some((hop) => hop.from === "bar"))
          }
          interactivePointLabel={pointLabel}
          interactivePointHighlight={pointHighlight}
          interactiveBarLabel={() => selected === "bar" ? "Move checker from the bar" : "Select checker on the bar"}
          interactiveBarHighlight={barHighlight}
        />
      </div>
      <div className={style.details}>
        <div className={style.statusRow} aria-live="polite">
          <span className={statusClassName}>
            {status === "complete" && "Move complete."}
            {status === "no-legal-move" && "No legal checker move for this roll."}
            {status === "ready" &&
              (selected
                ? `Choose a destination for the checker on ${locationLabel(selected)}.`
                : state.hops.length > 0
                  ? `Select a checker to play the ${state.remainingDice.join(" and ")}.`
                  : "Select a checker to begin.")}
          </span>
          {(notation || toPlay) && (
            <span className={style.moveSummary}>
              {notation && (
                <span className={style.notation} aria-label="Explored move sequence">
                  {notation}
                </span>
              )}
              {notation && toPlay && " · "}
              {toPlay}
            </span>
          )}
        </div>
        {selected !== null && selectedHops.length > 0 && (
          <div className={style.destinationGroup}>
            <span className={style.destinationHeading}>Legal destinations</span>
            <div className={style.destinationList}>
              {selectedHops.map((hop, index) => (
                <Button
                  key={`${hop.from}-${hop.to}-${hop.die}-${index}`}
                  size="compact"
                  className={style.destinationButton}
                  onClick={() => chooseHop(hop)}
                  aria-label={destinationLabel(hop)}
                >
                  {hop.to === "off" ? `Off · ${hop.die}` : `${hop.to}${hop.hit ? "*" : ""} · ${hop.die}`}
                </Button>
              ))}
            </div>
          </div>
        )}
        {selected !== null && selectedHops.length === 0 && (
          <p className={style.explanation}>That checker has no legal destination for the remaining dice.</p>
        )}
        <div className={style.controls}>
          <Button size="compact" onClick={undo} disabled={state.history.length === 0}>
            Undo last hop
          </Button>
          <Button size="compact" onClick={reset}>
            Reset position
          </Button>
        </div>
      </div>
    </div>
  );
}
