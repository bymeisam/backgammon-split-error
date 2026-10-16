"use client";

import { useMemo, useState } from "react";
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
  builderStateToLayout,
  isCheckersMirrored,
  layoutToBuilderState,
  toggleMirrorCheckers,
  toggleMirrorNumbers,
  toggleRotate,
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

  const item = items[index];
  const scores = useMemo(() => items.map(itemScore), [items]);

  if (!item) {
    return <p className={style.emptyNote}>No photos in snap-poc/.</p>;
  }

  const orientation = orientations[item.image] ?? DEFAULT_SNAP_ORIENTATION;
  const source: Source = sources[item.image] ?? (item.truth ? "truth" : "gemini");
  const sourceLayout = source === "truth" && item.truth ? item.truth.layout : item.gemini;
  const builderState = sourceLayout ? layoutToBuilderState(sourceLayout, orientation) : emptyBuilderState();
  const builderKey = `${item.image}|${source}|${orientation.bottomColor}|${orientation.bottomHome}|${Boolean(orientation.rotated)}|${item.truth?.savedAt ?? ""}`;
  const confirmed = items.filter((i) => i.truth).length;
  const score = scores[index];

  function go(next: number) {
    setIndex(next);
    setSaveError(null);
  }

  function setOrientation(next: Partial<SnapOrientation>) {
    setOrientations((previous) => ({ ...previous, [item.image]: { ...orientation, ...next } }));
  }

  const checkersMirrored = isCheckersMirrored(orientation);
  const numbersMirrored = Boolean(orientation.mirroredNumbers);
  const rotated = Boolean(orientation.rotated);

  async function save(state: PositionBuilderState) {
    if (!model) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/snap-poc/truth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: item.image, model, promptVersion, orientation, layout: builderStateToLayout(state, orientation) }),
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

          <Card as="section" className={style.infoCard} aria-label="Orientation">
            <p className={style.infoTitle}>Orientation</p>
            <div className={style.fieldLabel}>
              Bottom colour
              <div className={style.segmented}>
                {(["light", "dark"] as const).map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-pressed={orientation.bottomColor === color}
                    className={style.segmentOption(orientation.bottomColor === color)}
                    onClick={() => setOrientation({ bottomColor: color })}
                  >
                    {color === "light" ? "Light" : "Dark"}
                  </button>
                ))}
              </div>
            </div>
            {/* Three independent on/off toggles, each moving one thing on
                screen: the checkers mirror (the layout mapping flips), the
                point numbers mirror (Board's homeLeft, with the mapping
                flipped too so the checkers stay put), or the checkers turn
                180 degrees (the photo read upside down). Each is its own
                Button: primary when on, secondary when off. */}
            <div className={style.fieldLabel} role="group" aria-label="Board view">
              Board view
              <div className={style.toggleRow}>
                {(
                  [
                    ["Mirror checkers", checkersMirrored, toggleMirrorCheckers],
                    ["Mirror numbers", numbersMirrored, toggleMirrorNumbers],
                    ["Rotate board", rotated, toggleRotate],
                  ] as const
                ).map(([label, on, toggle]) => (
                  <Button
                    key={label}
                    size="compact"
                    variant={on ? "primary" : "secondary"}
                    aria-pressed={on}
                    onClick={() => setOrientation(toggle(orientation))}
                  >
                    {label}
                  </Button>
                ))}
              </div>
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
          homeLeft={numbersMirrored}
          extraActions={(state) => {
            const errors = validateBuilderState(state);
            return (
              <Card as="section" className={style.saveCard} aria-label="Save">
                <Button
                  variant="primary"
                  onClick={() => save(state)}
                  disabled={errors.length > 0 || saving || !model}
                >
                  {saving ? "Saving…" : "Save as correct"}
                </Button>
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
