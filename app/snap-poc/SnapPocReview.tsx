"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import PositionBuilder from "@/app/position-builder/PositionBuilder";
import Button from "@/app/components/ui/Button";
import Card from "@/app/components/ui/Card";
import { Table, TableBody, TableCell, TableHead, TableHeadCell, TableRow } from "@/app/components/ui/Table";
import {
  emptyPosition,
  initialPositionBuilderState,
  validateBuilderState,
  type PositionBuilderState,
} from "@/lib/positionBuilder";
import {
  DEFAULT_SNAP_ORIENTATION,
  SNAP_CORNERS,
  analyzingFor,
  boardHomeLeft,
  boardSwapColors,
  builderStateToLayout,
  cornerName,
  cornerRow,
  homeCorner,
  layoutToBuilderState,
  otherColor,
  setAnalyzingFor,
  setHomeCorner,
  toggleMirrorCheckers,
  toggleRotate,
  type SnapCorner,
  type SnapLayout,
  type SnapOrientation,
} from "@/lib/snapPocLayout";
import { SNAP_SYMMETRY_LABELS, scoreSnap, type SnapScore } from "@/lib/snapPocScore";
import type { SnapTruth } from "@/lib/snapPocFiles";
import { style } from "./snapPoc.styles";

export interface SnapPocItem {
  image: string;
  gemini: SnapLayout | null;
  parseError: string | null;
  truth: SnapTruth | null;
}

type Source = "truth" | "gemini";

type Step = 1 | 2;
type Color = "light" | "dark";

const COLOR_NAME: Record<Color, string> = { light: "Light", dark: "Dark" };

function itemScore(item: SnapPocItem): SnapScore | null {
  return item.gemini && item.truth ? scoreSnap(item.gemini, item.truth.layout) : null;
}

function yesNo(ok: boolean): string {
  return ok ? "✓" : "✗";
}

function emptyBuilderState(): PositionBuilderState {
  return { ...initialPositionBuilderState(), position: emptyPosition() };
}

export default function SnapPocReview({
  items: initialItems,
  model,
  promptVersion,
}: {
  items: SnapPocItem[];
  model: string | null;
  promptVersion: string | null;
}) {
  const [items, setItems] = useState(initialItems);
  const [index, setIndex] = useState(0);
  // Per photo: the orientation picked and whether the builder shows the
  // saved truth or Gemini's answer. A saved truth wins until reset.
  const [orientations, setOrientations] = useState<Record<string, SnapOrientation>>(() =>
    Object.fromEntries(initialItems.filter((i) => i.truth).map((i) => [i.image, i.truth!.orientation]))
  );
  const [sources, setSources] = useState<Record<string, Source>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // "Swap colours": display only, kept across photos for the session. It
  // only flips which colour Board draws each side in (the photo's colours by
  // default, boardSwapColors); it is not part of SnapOrientation, not saved
  // with the truth and not used by the scoring.
  const [swapColors, setSwapColors] = useState(false);
  // Per photo: the active step of the Orientation card. Every photo starts
  // at step 1 ("Make the board match the photo").
  const [steps, setSteps] = useState<Record<string, Step>>({});
  // The corner number hovered or focused in step 2: Board washes that
  // quadrant. Hover wins while the pointer is over a number.
  const [hoveredCorner, setHoveredCorner] = useState<SnapCorner | null>(null);
  const [focusedCorner, setFocusedCorner] = useState<SnapCorner | null>(null);
  // After a step change, the control to focus once it has re-rendered: the
  // selected corner number (step 2) or Rotate board (back in step 1).
  const focusTarget = useRef<"corner" | "rotate" | null>(null);
  const cornerRefs = useRef<Partial<Record<SnapCorner, HTMLButtonElement | null>>>({});
  const colorRefs = useRef<Partial<Record<Color, HTMLButtonElement | null>>>({});
  const rotateId = "snap-orientation-rotate";

  const item = items[index];
  const scores = useMemo(() => items.map(itemScore), [items]);
  const orientation: SnapOrientation = (item && orientations[item.image]) || DEFAULT_SNAP_ORIENTATION;
  const selectedCorner = homeCorner(orientation);

  useEffect(() => {
    if (focusTarget.current === null) return;
    if (focusTarget.current === "corner") cornerRefs.current[selectedCorner]?.focus();
    else document.getElementById(rotateId)?.focus();
    focusTarget.current = null;
  });

  if (!item) {
    return <p className={style.emptyNote}>No photos in snap-poc/.</p>;
  }

  const step: Step = steps[item.image] ?? 1;
  const inStep1 = step === 1;
  const color = analyzingFor(orientation);
  const opponentColor = otherColor(color);
  const source: Source = sources[item.image] ?? (item.truth ? "truth" : "gemini");
  const sourceLayout = source === "truth" && item.truth ? item.truth.layout : item.gemini;
  const builderState = sourceLayout ? layoutToBuilderState(sourceLayout, orientation) : emptyBuilderState();
  // The builder is rebuilt (its edits dropped) whenever the game or the view
  // changes; Swap colours and the step only change the drawing around it.
  const builderKey = [
    item.image,
    source,
    orientation.bottomColor,
    orientation.bottomHome,
    Boolean(orientation.rotated),
    Boolean(orientation.layoutMirrored),
    color,
    item.truth?.savedAt ?? "",
  ].join("|");
  const confirmed = items.filter((i) => i.truth).length;
  const score = scores[index];
  const highlightedCorner = inStep1 ? null : (hoveredCorner ?? focusedCorner);
  const moverAtTop = cornerRow(selectedCorner) === "top";
  // The disc colour for each photo colour in the legend: what Board draws
  // it in (dark checkers in the mine palette unless Swap colours is on).
  const discPalette = (c: Color): "mine" | "opponent" => ((c === "dark") !== swapColors ? "mine" : "opponent");

  function go(next: number) {
    setIndex(next);
    setSaveError(null);
    setHoveredCorner(null);
    setFocusedCorner(null);
  }

  function setOrientation(next: SnapOrientation) {
    setOrientations((previous) => ({ ...previous, [item.image]: next }));
  }

  function setStep(next: Step) {
    setSteps((previous) => ({ ...previous, [item.image]: next }));
    setHoveredCorner(null);
    focusTarget.current = next === 2 ? "corner" : "rotate";
  }

  function pickCorner(corner: SnapCorner) {
    setOrientation(setHomeCorner(orientation, corner));
    // A tap on touch selects and focuses, so the wash shows the selection.
    cornerRefs.current[corner]?.focus();
  }

  function pickColor(next: Color) {
    setOrientation(setAnalyzingFor(orientation, next));
    colorRefs.current[next]?.focus();
  }

  // Arrow keys move through a radio group (and select), as native radios do.
  function radioKeys<T>(event: KeyboardEvent<HTMLButtonElement>, options: readonly T[], current: T, pick: (next: T) => void) {
    const delta = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (delta === 0) return;
    event.preventDefault();
    const i = options.indexOf(current);
    pick(options[(i + delta + options.length) % options.length]);
  }

  async function save(state: PositionBuilderState) {
    if (!model) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/snap-poc/truth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: item.image,
          model,
          promptVersion,
          orientation: { ...orientation, analyzingFor: color },
          layout: builderStateToLayout(state, orientation),
        }),
      });
      const json = (await res.json().catch(() => null)) as (SnapTruth & { error?: string }) | null;
      if (!res.ok || !json || json.error) throw new Error(json?.error ?? `HTTP ${res.status}`);
      setItems((previous) => previous.map((i) => (i.image === json.image ? { ...i, truth: json } : i)));
      setSources((previous) => ({ ...previous, [item.image]: "truth" }));
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Saving failed.");
    } finally {
      setSaving(false);
    }
  }

  const scored = scores.filter((s): s is SnapScore => s !== null);
  const count = (pick: (s: SnapScore) => boolean) => scored.filter(pick).length;
  const sum = (pick: (s: SnapScore) => number) => scored.reduce((total, s) => total + pick(s), 0);
  const avg = (pick: (s: SnapScore) => number) => (scored.length ? (sum(pick) / scored.length).toFixed(1) : "–");

  return (
    <div className={style.root}>
      <Table>
        <TableHead>
          <TableHeadCell>Photo</TableHeadCell>
          <TableHeadCell>Confidence</TableHeadCell>
          <TableHeadCell numeric>Points</TableHeadCell>
          <TableHeadCell numeric>Checkers off</TableHeadCell>
          <TableHeadCell>Bar</TableHeadCell>
          <TableHeadCell>Tray</TableHeadCell>
          <TableHeadCell>Dice</TableHeadCell>
          <TableHeadCell>Cube</TableHeadCell>
          <TableHeadCell>Best symmetry</TableHeadCell>
        </TableHead>
        <TableBody>
          {items.map((row, i) => {
            const s = scores[i];
            return (
              <TableRow key={row.image}>
                <TableCell>
                  <button type="button" className={style.rowButton(i === index)} title={row.image} onClick={() => go(i)}>
                    {i + 1}. {row.image}
                  </button>
                </TableCell>
                <TableCell kind="muted">{row.gemini?.confidence ?? "parse error"}</TableCell>
                <TableCell kind="numeric">{s ? `${s.pointsExact}/24` : "–"}</TableCell>
                <TableCell kind="numeric">{s ? s.checkersOff : "–"}</TableCell>
                <TableCell className={s ? style.okMark(s.barOk) : undefined}>{s ? yesNo(s.barOk) : "–"}</TableCell>
                <TableCell className={s ? style.okMark(s.offOk) : undefined}>{s ? yesNo(s.offOk) : "–"}</TableCell>
                <TableCell className={s ? style.okMark(s.diceOk) : undefined}>{s ? yesNo(s.diceOk) : "–"}</TableCell>
                <TableCell className={s ? style.okMark(s.cubeOk) : undefined}>{s ? yesNo(s.cubeOk) : "–"}</TableCell>
                <TableCell kind="muted">
                  {s ? `${SNAP_SYMMETRY_LABELS[s.bestSymmetry]} (${s.pointsExactBest}/24)` : "–"}
                </TableCell>
              </TableRow>
            );
          })}
          <TableRow className={style.totalRow}>
            <TableCell>
              {confirmed} of {items.length} confirmed
            </TableCell>
            <TableCell kind="muted">
              {items.filter((i) => i.gemini?.confidence === "high").length} high
            </TableCell>
            <TableCell kind="numeric">
              {sum((s) => s.pointsExact)}/{scored.length * 24} (avg {avg((s) => s.pointsExact)})
            </TableCell>
            <TableCell kind="numeric">
              {sum((s) => s.checkersOff)} (avg {avg((s) => s.checkersOff)})
            </TableCell>
            <TableCell>{count((s) => s.barOk)}/{scored.length}</TableCell>
            <TableCell>{count((s) => s.offOk)}/{scored.length}</TableCell>
            <TableCell>{count((s) => s.diceOk)}/{scored.length}</TableCell>
            <TableCell>{count((s) => s.cubeOk)}/{scored.length}</TableCell>
            <TableCell kind="muted">{count((s) => s.bestSymmetry !== "identity")} not as read</TableCell>
          </TableRow>
        </TableBody>
      </Table>

      <div className={style.navBar}>
        <div className={style.navButtons}>
          <Button size="compact" className={style.navButton} onClick={() => go(index - 1)} disabled={index === 0}>
            ← Previous
          </Button>
          <Button size="compact" className={style.navButton} onClick={() => go(index + 1)} disabled={index === items.length - 1}>
            Next →
          </Button>
          <span className={style.navStatus}>
            Photo {index + 1} of {items.length} · {confirmed} of {items.length} confirmed
          </span>
        </div>
        <span className={style.currentName}>{item.image}</span>
      </div>

      <div className={style.workArea}>
        <div className={style.photoColumn}>
          <Card className={style.photoCard}>
            {/* eslint-disable-next-line @next/next/no-img-element -- a local dev-only file, shown as is */}
            <img className={style.photo} src={`/api/snap-poc/image/${encodeURIComponent(item.image)}`} alt={item.image} />
          </Card>

          <Card as="section" className={style.infoCard} aria-label="Model reading">
            <p className={style.infoTitle}>Model reading · confidence {item.gemini?.confidence ?? "–"}</p>
            {item.parseError && <p className={style.infoError}>Parse error: {item.parseError}</p>}
            <p className={style.infoText}>{item.gemini?.notes || "No notes."}</p>
          </Card>

          {/* Orientation, in two steps, one active at a time. Step 1 makes the
              drawn board look like the photo (Rotate and Swap colours only
              change the view; Mirror checkers fixes a reading that came out
              back to front, so it changes the game). Step 2 sets the game on
              the board as drawn: the colour analysed for, and which drawn
              corner is its home board (lib/snapPocLayout.ts). */}
          <Card as="section" className={style.orientationCard} aria-label="Orientation">
            <p className={style.infoTitle}>Orientation</p>

            <div className={style.step(inStep1, false)} role="group" aria-labelledby="snap-step-1">
              <div className={style.stepHead}>
                <span className={style.stepNumber(inStep1)} aria-hidden="true">
                  {inStep1 ? "1" : "✓"}
                </span>
                <span id="snap-step-1" className={style.stepTitle(inStep1)}>
                  Make the board match the photo
                </span>
                <span className={style.stepTag}>doesn&apos;t set the game</span>
              </div>
              <div className={style.toggleRow}>
                <Button
                  id={rotateId}
                  size="compact"
                  variant={orientation.rotated ? "primary" : "secondary"}
                  aria-pressed={Boolean(orientation.rotated)}
                  disabled={!inStep1}
                  onClick={() => setOrientation(toggleRotate(orientation))}
                >
                  Rotate board
                </Button>
                <Button
                  size="compact"
                  variant={swapColors ? "primary" : "secondary"}
                  aria-pressed={swapColors}
                  disabled={!inStep1}
                  onClick={() => setSwapColors((on) => !on)}
                >
                  Swap colours
                </Button>
                <Button
                  size="compact"
                  variant={orientation.layoutMirrored ? "primary" : "secondary"}
                  aria-pressed={Boolean(orientation.layoutMirrored)}
                  aria-describedby="snap-mirror-hint"
                  disabled={!inStep1}
                  onClick={() => setOrientation(toggleMirrorCheckers(orientation))}
                >
                  Mirror checkers
                </Button>
              </div>
              <p id="snap-mirror-hint" className={style.fieldHint}>
                Mirror checkers is for a reading that came out back to front: it flips the checkers left to right.
              </p>
              {inStep1 && (
                <>
                  <p className={style.fieldHint}>Turn, recolour or mirror the board until it looks like the photo.</p>
                  <Button size="compact" variant="primary" className={style.nextButton} onClick={() => setStep(2)}>
                    Board looks right →
                  </Button>
                </>
              )}
            </div>

            <div
              className={style.step(!inStep1, true)}
              role="group"
              aria-labelledby="snap-step-2"
              aria-describedby={inStep1 ? undefined : "snap-legend"}
            >
              <div className={style.stepHead}>
                <span className={style.stepNumber(!inStep1)} aria-hidden="true">
                  2
                </span>
                <span id="snap-step-2" className={style.stepTitle(!inStep1)}>
                  Make the game right
                </span>
                <span className={style.stepTag}>sets the pips</span>
              </div>
              <div className={style.fieldRow}>
                <span id="snap-analyzing-for" className={style.fieldName}>
                  Analyzing for
                </span>
                <div className={style.segmented(2)} role="radiogroup" aria-labelledby="snap-analyzing-for">
                  {(["dark", "light"] as const).map((c) => (
                    <button
                      key={c}
                      ref={(el) => {
                        colorRefs.current[c] = el;
                      }}
                      type="button"
                      role="radio"
                      aria-checked={color === c}
                      tabIndex={color === c ? 0 : -1}
                      disabled={inStep1}
                      className={style.segmentOption(color === c)}
                      onClick={() => pickColor(c)}
                      onKeyDown={(event) => radioKeys(event, ["dark", "light"] as const, color, pickColor)}
                    >
                      {COLOR_NAME[c]}
                    </button>
                  ))}
                </div>
              </div>
              <div className={style.fieldRow}>
                <span id="snap-home-board" className={style.fieldName}>
                  Home board
                </span>
                <div className={style.segmented(4)} role="radiogroup" aria-labelledby="snap-home-board">
                  {SNAP_CORNERS.map((corner) => {
                    const label = `${corner} · ${cornerName(corner)}`;
                    return (
                      <button
                        key={corner}
                        ref={(el) => {
                          cornerRefs.current[corner] = el;
                        }}
                        type="button"
                        role="radio"
                        aria-checked={selectedCorner === corner}
                        aria-label={label}
                        title={label}
                        tabIndex={selectedCorner === corner ? 0 : -1}
                        disabled={inStep1}
                        className={style.segmentOption(selectedCorner === corner)}
                        onClick={() => pickCorner(corner)}
                        onKeyDown={(event) => radioKeys(event, SNAP_CORNERS, selectedCorner, pickCorner)}
                        onPointerEnter={() => setHoveredCorner(corner)}
                        onPointerLeave={() => setHoveredCorner(null)}
                        onFocus={() => setFocusedCorner(corner)}
                        onBlur={() => setFocusedCorner(null)}
                      >
                        {corner}
                      </button>
                    );
                  })}
                </div>
              </div>
              <p className={style.fieldHint}>
                {inStep1
                  ? "Confirm the board first."
                  : `The corner of the big board where ${COLOR_NAME[color]}'s home board is, read 1 top-left to 4 bottom-right.`}
              </p>
              {!inStep1 && (
                <>
                  <div id="snap-legend" className={style.legend} aria-live="polite">
                    <span className={style.legendItem}>
                      <i className={style.legendDisc(discPalette(color))} aria-hidden="true" />
                      {COLOR_NAME[color]} to play · home board {cornerName(selectedCorner).toLowerCase()} ({selectedCorner})
                    </span>
                    <span className={style.legendItem}>
                      <i className={style.legendDisc(discPalette(opponentColor))} aria-hidden="true" />
                      {COLOR_NAME[opponentColor]} · home board{" "}
                      {cornerName(homeCorner(orientation, opponentColor)).toLowerCase()} (
                      {homeCorner(orientation, opponentColor)})
                    </span>
                  </div>
                  {moverAtTop && (
                    <p className={style.nudge}>
                      {COLOR_NAME[color]} is at the top of this board. Most tools draw the player to move at the
                      bottom.{" "}
                      <button
                        type="button"
                        className={style.nudgeLink}
                        onClick={() => {
                          setOrientation(toggleRotate(orientation));
                          focusTarget.current = "corner";
                        }}
                      >
                        Turn the board so {COLOR_NAME[color]} is at the bottom
                      </button>
                    </p>
                  )}
                  <Button size="compact" variant="quiet" className={style.backButton} onClick={() => setStep(1)}>
                    <span aria-hidden="true">← </span>Not like the photo
                  </Button>
                </>
              )}
            </div>

            <p className={style.infoText}>
              Showing {source === "truth" ? "your saved board" : "the model's answer"}.
            </p>
            {source === "truth" && item.gemini && (
              <button
                type="button"
                className={style.resetLink}
                onClick={() => setSources((previous) => ({ ...previous, [item.image]: "gemini" }))}
              >
                Reset to Gemini&apos;s answer
              </button>
            )}
          </Card>
        </div>

        <PositionBuilder
          key={builderKey}
          canPostToForum={false}
          initialState={builderState}
          homeLeft={boardHomeLeft(orientation)}
          swapCheckerColors={boardSwapColors(orientation, swapColors)}
          showPips={!inStep1}
          cornerGuide={
            inStep1
              ? undefined
              : {
                  selected: selectedCorner,
                  selectedTitle: `${COLOR_NAME[color]}'s home board`,
                  highlighted: highlightedCorner,
                }
          }
          extraActions={(state) => {
            const errors = validateBuilderState(state);
            return (
              <Card as="section" className={style.saveCard} aria-label="Save">
                <Button
                  variant="primary"
                  onClick={() => save(state)}
                  disabled={inStep1 || errors.length > 0 || saving || !model}
                  aria-describedby="snap-save-hint"
                >
                  {saving ? "Saving…" : "Save as correct"}
                </Button>
                <p id="snap-save-hint" className={style.saveHint}>
                  {inStep1 ? "Finish step 2 to save: the game isn't set yet." : "Saves this board and game."}
                </p>
                {saveError && <p className={style.saveError}>{saveError}</p>}
                {score && (
                  <dl className={style.scoreList}>
                    <dt className={style.scoreLabel}>Points exact</dt>
                    <dd className={style.scoreValue}>{score.pointsExact}/24</dd>
                    <dt className={style.scoreLabel}>Checkers off</dt>
                    <dd className={style.scoreValue}>{score.checkersOff}</dd>
                    <dt className={style.scoreLabel}>Bar · tray</dt>
                    <dd className={style.scoreValue}>
                      {yesNo(score.barOk)} · {yesNo(score.offOk)}
                    </dd>
                    <dt className={style.scoreLabel}>Dice · cube</dt>
                    <dd className={style.scoreValue}>
                      {yesNo(score.diceOk)} · {yesNo(score.cubeOk)}
                    </dd>
                    <dt className={style.scoreLabel}>Best symmetry</dt>
                    <dd className={style.scoreValue}>
                      {SNAP_SYMMETRY_LABELS[score.bestSymmetry]} ({score.pointsExactBest}/24)
                    </dd>
                  </dl>
                )}
              </Card>
            );
          }}
        />
      </div>
    </div>
  );
}
