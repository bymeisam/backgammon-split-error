// Snaps PoC: score every cached Gemini answer that has a truth file.
//
// Usage: npm run snaps:score
//
// For every snap-poc/results/<model>/<version>/ folder, scores each answer
// against snap-poc/truth/<image>.json with lib/snapPocScore.ts's scoreSnap,
// then prints markdown: one table per photo set (scripts/snaps/photo-sets.ts)
// and a per-photo table showing which runs were perfect, so regressions show.
// Local files only: no DB, no network. Run from the repo root (npm does).
import { listSnapImages, listSnapRuns, readSnapResult, readSnapTruth, snapVersionNumber } from "../../lib/snapPocFiles";
import { scoreSnap } from "../../lib/snapPocScore";
import { PHOTO_SETS } from "./photo-sets";
import { renderPerPhoto, renderSetTable, type ScoredAnswer } from "./scoreTable";

function main() {
  const runs = listSnapRuns().sort(
    (a, b) => a.model.localeCompare(b.model) || snapVersionNumber(a.version) - snapVersionNumber(b.version),
  );
  if (runs.length === 0) {
    console.error("No results/<model>/<version>/ folders under snap-poc/.");
    process.exit(1);
  }
  const images = listSnapImages();
  const truths = new Map(images.map((image) => [image, readSnapTruth(image)]));

  const answers: ScoredAnswer[] = [];
  const noTruth: string[] = [];
  for (const run of runs) {
    const id = `${run.model}/${run.version}`;
    let answered = 0;
    let waiting = 0;
    for (const image of images) {
      const result = readSnapResult(run, image);
      if (!result) continue;
      answered++;
      const truth = truths.get(image);
      if (!truth) {
        waiting++;
        continue;
      }
      answers.push({ run: id, image, score: result.layout ? scoreSnap(result.layout, truth.layout) : null });
    }
    noTruth.push(`- ${id}: ${answered} answers, ${waiting} without truth yet`);
  }

  const ids = runs.map((r) => `${r.model}/${r.version}`);
  const truthCount = [...truths.values()].filter(Boolean).length;
  console.log(`## Snaps scores (${new Date().toISOString().slice(0, 10)})\n`);
  console.log(`${images.length} photos, ${truthCount} with truth.\n`);
  console.log(noTruth.join("\n") + "\n");
  for (const set of PHOTO_SETS) console.log(renderSetTable(set, ids, answers) + "\n");
  console.log(renderPerPhoto(ids, answers));
}

main();
