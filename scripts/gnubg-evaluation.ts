import "dotenv/config";
import { prismaReadOnly } from "@/lib/prisma";
import { getDecisionAnalysis } from "@/lib/analysis";
import { galaxyReview } from "@/lib/analysis/galaxyFields";
import { decodeGnuPositionId } from "@/lib/gnuPositionId";
import { analyze, allRolls, timeEmptyRun, EVALUATION_PLIES } from "@/lib/engine/gnubg";

function normalize(move: string): string {
  return move.replace(/\*/g, "").split(/\s+/).flatMap((token) => {
    const repeated = /^(.+?)\((\d+)\)$/.exec(token);
    return repeated ? Array(Number(repeated[2])).fill(repeated[1]) : [token];
  }).sort().join(" ").toLowerCase();
}

function errorBand(loss: number | null): "none" | "doubtful" | "error" | "blunder" {
  if (loss === null || loss < 0.0001) return "none";
  if (loss <= 0.02) return "doubtful";
  if (loss < 0.0799) return "error";
  return "blunder";
}

async function main() {
  const dbUrl = process.env.DATABASE_URL_READONLY;
  if (!dbUrl) throw new Error("DATABASE_URL_READONLY is not configured");
  const url = new URL(dbUrl);
  if (!["localhost", "127.0.0.1"].includes(url.hostname) || decodeURIComponent(url.username) !== "bg_db_ro") {
    throw new Error("Evaluation requires local DATABASE_URL_READONLY using bg_db_ro");
  }

  const strata = ["opening_game", "middle_game", "race"] as const;
  const rows = await prismaReadOnly.decision.findMany({
    where: {
      kind: "CHECKER",
      countAsDecision: true,
      rawError: { not: null },
      sourcePositionId: { not: null },
      classification: { in: [...strata] },
      game: { match: { source: "galaxy" } },
    },
    select: {
      id: true,
      sourcePositionId: true,
      rawError: true,
      errorSeverity: true,
      classification: true,
      plyNumber: true,
      raw: true,
    },
    orderBy: { id: "desc" },
    take: 6000,
  });

  type Row = (typeof rows)[number];
  type Item = Row & { matchId: string; playedMove: string; galaxyBest: string; playedEquity: number; phase: string };
  const eligible: Item[] = [];
  for (const row of rows) {
    const analysis = getDecisionAnalysis({ source: "galaxy", raw: row.raw });
    if (!analysis || analysis.kind !== "checker") continue;
    const played = analysis.candidates.find((candidate) => candidate.played);
    const best = analysis.candidates[0];
    const matchId = galaxyReview(row.raw)?.source_match?.formatted_value;
    if (!played || !best || typeof matchId !== "string") continue;
    let position;
    try { position = decodeGnuPositionId(row.sourcePositionId!); } catch { continue; }
    const phase = position.mineOff + position.opponentOff >= 10 ? "bear-off" : row.classification === "opening_game" ? "opening" : "middle game";
    eligible.push({ ...row, matchId, playedMove: played.move, galaxyBest: best.move, playedEquity: played.equity, phase });
  }

  let seed = 0x6d2b79f5;
  function shuffle<T>(items: T[]): T[] {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
      seed = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      seed ^= seed + Math.imul(seed ^ (seed >>> 7), 61 | seed);
      const j = i * ((seed ^ (seed >>> 14)) >>> 0) / 4294967296 | 0;
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
  const sample: Item[] = [];
  for (const [phase, count] of [["opening", 55], ["middle game", 75], ["bear-off", 70]] as const) {
    sample.push(...shuffle(eligible.filter((row) => row.phase === phase)).slice(0, count));
  }
  if (sample.length < 180) throw new Error(`Only ${sample.length} decisions available; wanted about 200`);

  const startupRuns: number[] = [];
  for (let i = 0; i < 5; i++) startupRuns.push(await timeEmptyRun());
  const startupRunsSorted = [...startupRuns].sort((a, b) => a - b);
  const dockerStartupMs = startupRunsSorted[2];

  const outcomes = [];
  const depthMismatches: { id: number; phase: string; severity: string; positionId: string; matchId: string; error: string }[] = [];
  for (const row of sample) {
    const started = performance.now();
    let result;
    try {
      result = await analyze(row.sourcePositionId!, row.matchId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes("best candidate was") || !message.includes(`expected ${EVALUATION_PLIES}-ply`)) throw error;
      depthMismatches.push({ id: row.id, phase: row.phase, severity: row.errorSeverity, positionId: row.sourcePositionId!, matchId: row.matchId, error: message });
      continue;
    }
    const elapsedMs = performance.now() - started;
    const played = result.candidates.find((candidate) => normalize(candidate.move) === normalize(row.playedMove));
    const bestMove = result.candidates[0].move;
    const bestEquity = result.candidates[0].equity;
    const playedLoss = played ? bestEquity - played.equity : null;
    const galaxyLoss = row.rawError === null ? null : Math.max(0, -row.rawError);
    const galaxyErrorBand = errorBand(galaxyLoss);
    const gnubgErrorBand = errorBand(playedLoss);
    outcomes.push({
      id: row.id,
      phase: row.phase,
      classification: row.classification,
      errorSeverity: row.errorSeverity,
      rawError: row.rawError,
      positionId: row.sourcePositionId,
      matchId: row.matchId,
      roll: result.roll.join("-"),
      galaxyBest: row.galaxyBest,
      gnubgBest: bestMove,
      bestAgrees: normalize(row.galaxyBest) === normalize(bestMove),
      galaxyPlayed: row.playedMove,
      galaxyPlayedEquity: row.playedEquity,
      gnubgPlayedEquity: played?.equity ?? null,
      playedEquityDifference: played ? played.equity - row.playedEquity : null,
      gnubgPlayedLoss: playedLoss,
      galaxyErrorBand,
      gnubgErrorBand,
      absoluteLossDifference: playedLoss === null || galaxyLoss === null ? null : Math.abs(playedLoss - galaxyLoss),
      gnubgCallsMistake: playedLoss !== null && playedLoss >= 0.08,
      elapsedMs,
    });
    if ((outcomes.length % 10) === 0) console.log(`Compared ${outcomes.length}/${sample.length}`);
  }

  const rollTimer = performance.now();
  const middle = sample[Math.floor(sample.length / 2)];
  let allRollError: string | null = null;
  try {
    await allRolls(middle.sourcePositionId!, middle.matchId);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("best candidate was") || !message.includes("expected 2-ply")) throw error;
    allRollError = message;
  }
  const allRollMs = performance.now() - rollTimer;
  const knownPlayed = outcomes.filter((row) => row.playedEquityDifference !== null);
  const sortedDiff = knownPlayed.map((row) => Math.abs(row.playedEquityDifference!)).sort((a, b) => a - b);
  const sortedLossDiff = outcomes.flatMap((row) => row.absoluteLossDifference === null ? [] : [row.absoluteLossDifference]).sort((a, b) => a - b);
  const bandSummary = Object.fromEntries(["ERROR", "BLUNDER"].map((severity) => {
    const items = outcomes.filter((row) => row.errorSeverity === severity);
    return [severity, {
      n: items.length,
      sameBand: items.filter((row) => row.gnubgErrorBand.toUpperCase() === severity).length,
      lowerBand: items.filter((row) => severity === "ERROR" ? row.gnubgErrorBand === "doubtful" : ["error", "doubtful"].includes(row.gnubgErrorBand)).length,
      noneBand: items.filter((row) => row.gnubgErrorBand === "none").length,
      higherBand: items.filter((row) => severity === "ERROR" && row.gnubgErrorBand === "blunder").length,
    }];
  }));
  const nonErrors = outcomes.filter((row) => ["NONE", "DOUBTFUL"].includes(row.errorSeverity));
  console.log(JSON.stringify({
    db: { host: url.hostname, database: url.pathname.slice(1), candidateRows: rows.length, eligible: eligible.length },
    sampleCounts: Object.fromEntries(["opening", "middle game", "bear-off"].map((phase) => [phase, sample.filter((row) => row.phase === phase).length])),
    rawErrorBands: {
      galaxy: { doubtful: "0.0001–0.02", error: ">0.02–0.0798", blunder: ">=0.0799" },
      note: "Galaxy loss is max(0, -rawError); positive NONE values are not treated as loss.",
    },
    evaluation: {
      plies: EVALUATION_PLIES, attempted: sample.length, analyzed: outcomes.length, depthMismatches: depthMismatches.length,
      bestAgrees: outcomes.filter((row) => row.bestAgrees).length,
      agreementRate: outcomes.filter((row) => row.bestAgrees).length / outcomes.length,
      playedEquityMeasured: knownPlayed.length,
      medianAbsEquityDifference: sortedDiff[Math.floor(sortedDiff.length / 2)] ?? null,
      medianAbsPlayedLossDifference: sortedLossDiff[Math.floor(sortedLossDiff.length / 2)] ?? null,
      dockerEmptyRunMedianMs: dockerStartupMs,
      medianPositionTotalMs: outcomes.map((row) => row.elapsedMs).sort((a, b) => a - b)[Math.floor(outcomes.length / 2)],
      medianPositionEngineEstimateMs: outcomes.map((row) => row.elapsedMs).sort((a, b) => a - b)[Math.floor(outcomes.length / 2)] - dockerStartupMs,
      all21RollsTotalMs: allRollMs,
      all21RollsEngineEstimateMs: allRollMs - dockerStartupMs,
      all21RollsDepthError: allRollError,
    },
    severity: bandSummary,
    nonErrors: {
      n: nonErrors.length,
      gnubgErrorOrBlunderFalseAlarms: nonErrors.filter((row) => ["error", "blunder"].includes(row.gnubgErrorBand)).length,
      gnubgDoubtfulOrHigher: nonErrors.filter((row) => row.gnubgErrorBand !== "none").length,
    },
    depthMismatches,
    disagreements: outcomes.filter((row) => !row.bestAgrees).slice(0, 8),
    unmeasuredPlayedEquity: outcomes.filter((row) => row.playedEquityDifference === null).length,
    outcomes,
  }, null, 2));
  await prismaReadOnly.$disconnect();
}

void main();
