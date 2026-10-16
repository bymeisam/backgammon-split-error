// Snaps PoC: pure aggregation and markdown rendering for scripts/snaps/score.ts.
// No filesystem access, so it is unit-tested (scoreTable.test.ts).

import type { SnapScore } from "../../lib/snapPocScore";
import type { PhotoSet } from "./photo-sets";

/** One cached answer that has a truth file. `score` is null on a parse error. */
export interface ScoredAnswer {
  /** "<model>/<version>". */
  run: string;
  image: string;
  score: SnapScore | null;
}

export interface RunSummary {
  run: string;
  /** Answers with a truth file, parse errors included. */
  scored: number;
  /** Whole board right (isPerfect). */
  perfect: number;
  /** All 24 points right (the bar, tray, dice or cube may still be off). */
  allPoints: number;
  /** Mean of pointsExact over `scored`; a parse error counts as 0. */
  avgPoints: number;
  dice: number;
  bar: number;
  cube: number;
  tray: number;
  parseErrors: number;
}

/** Every point, the bar, the tray, the dice and the cube exactly right, as read. */
export function isPerfect(s: SnapScore): boolean {
  return s.pointsExact === 24 && s.barOk && s.offOk && s.diceOk && s.cubeOk;
}

export function summarizeRun(run: string, answers: ScoredAnswer[]): RunSummary {
  const mine = answers.filter((a) => a.run === run);
  const ok = mine.map((a) => a.score).filter((s): s is SnapScore => s !== null);
  const count = (pick: (s: SnapScore) => boolean) => ok.filter(pick).length;
  const points = ok.reduce((total, s) => total + s.pointsExact, 0);
  return {
    run,
    scored: mine.length,
    perfect: count(isPerfect),
    allPoints: count((s) => s.pointsExact === 24),
    avgPoints: mine.length ? points / mine.length : 0,
    dice: count((s) => s.diceOk),
    bar: count((s) => s.barOk),
    cube: count((s) => s.cubeOk),
    tray: count((s) => s.offOk),
    parseErrors: mine.length - ok.length,
  };
}

function frac(n: number, of: number): string {
  return `${n}/${of}`;
}

/** One markdown table: a row per run that has at least one scored answer in the set. */
export function renderSetTable(set: PhotoSet, runs: string[], answers: ScoredAnswer[]): string {
  const inSet = answers.filter((a) => set.includes(a.image));
  const lines = [
    `### ${set.name}: ${set.description}`,
    "",
    "| Run | Photos scored | Perfect board | All 24 points | Points avg /24 | Dice | Bar | Cube | Tray | Parse errors |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
  ];
  let rows = 0;
  for (const run of runs) {
    const s = summarizeRun(run, inSet);
    if (s.scored === 0) continue;
    rows++;
    const pct = Math.round((s.avgPoints / 24) * 100);
    lines.push(
      `| ${run} | ${s.scored} | ${frac(s.perfect, s.scored)} | ${frac(s.allPoints, s.scored)} | ${s.avgPoints.toFixed(1)} (${pct}%) | ` +
        `${frac(s.dice, s.scored)} | ${frac(s.bar, s.scored)} | ${frac(s.cube, s.scored)} | ` +
        `${frac(s.tray, s.scored)} | ${s.parseErrors} |`,
    );
  }
  if (rows === 0) lines.push("| (no answers with truth yet) | | | | | | | | | |");
  return lines.join("\n");
}

/** Per photo with truth: each run's points (or "parse error"), and which runs were perfect. */
export function renderPerPhoto(runs: string[], answers: ScoredAnswer[]): string {
  const images = [...new Set(answers.map((a) => a.image))].sort();
  const lines = [
    "### Per photo",
    "",
    `| Photo | ${runs.join(" | ")} | Perfect in |`,
    `| --- | ${runs.map(() => "---:").join(" | ")} | --- |`,
  ];
  for (const image of images) {
    const cells: string[] = [];
    const perfectIn: string[] = [];
    for (const run of runs) {
      const a = answers.find((x) => x.run === run && x.image === image);
      if (!a) cells.push("–");
      else if (!a.score) cells.push("parse error");
      else {
        cells.push(`${a.score.pointsExact}/24${isPerfect(a.score) ? " ✓" : ""}`);
        if (isPerfect(a.score)) perfectIn.push(run);
      }
    }
    lines.push(`| ${image} | ${cells.join(" | ")} | ${perfectIn.join(", ") || "none"} |`);
  }
  return lines.join("\n");
}
