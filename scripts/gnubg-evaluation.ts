import "dotenv/config";
import { prismaReadOnly } from "@/lib/prisma";
import { getDecisionAnalysis } from "@/lib/analysis";
import { galaxyReview } from "@/lib/analysis/galaxyFields";
import { decodeGnuPositionId } from "@/lib/gnuPositionId";
import { analyze, allRolls } from "@/lib/engine/gnubg";

function normalize(move: string): string {
  return move.replace(/\*/g, "").split(/\s+/).flatMap((token) => {
    const repeated = /^(.+?)\((\d+)\)$/.exec(token);
    return repeated ? Array(Number(repeated[2])).fill(repeated[1]) : [token];
  }).sort().join(" ").toLowerCase();
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

  const outcomes = [];
  for (const row of sample) {
    const started = performance.now();
    const result = await analyze(row.sourcePositionId!, row.matchId);
    const elapsedMs = performance.now() - started;
    const played = result.candidates.find((candidate) => normalize(candidate.move) === normalize(row.playedMove));
    const bestMove = result.candidates[0].move;
    const bestEquity = result.candidates[0].equity;
    const playedLoss = played ? bestEquity - played.equity : null;
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
      gnubgCallsMistake: playedLoss !== null && playedLoss >= 0.08,
      elapsedMs,
    });
    if ((outcomes.length % 10) === 0) console.log(`Compared ${outcomes.length}/${sample.length}`);
  }

  const rollTimer = performance.now();
  const middle = sample[Math.floor(sample.length / 2)];
  await allRolls(middle.sourcePositionId!, middle.matchId);
  const allRollMs = performance.now() - rollTimer;
  const knownPlayed = outcomes.filter((row) => row.playedEquityDifference !== null);
  const sortedDiff = knownPlayed.map((row) => Math.abs(row.playedEquityDifference!)).sort((a, b) => a - b);
  const summarize = (items: typeof outcomes) => ({ n: items.length, agreement: items.filter((row) => row.bestAgrees).length, errorRows: items.filter((row) => ["ERROR", "BLUNDER"].includes(row.errorSeverity)).length, errorCaught: items.filter((row) => ["ERROR", "BLUNDER"].includes(row.errorSeverity) && row.gnubgCallsMistake).length });
  console.log(JSON.stringify({
    db: { host: url.hostname, database: url.pathname.slice(1), candidateRows: rows.length, eligible: eligible.length },
    sampleCounts: Object.fromEntries(["opening", "middle game", "bear-off"].map((phase) => [phase, sample.filter((row) => row.phase === phase).length])),
    evaluation: { plies: 0, n: outcomes.length, bestAgrees: outcomes.filter((row) => row.bestAgrees).length, agreementRate: outcomes.filter((row) => row.bestAgrees).length / outcomes.length,
      playedEquityMeasured: knownPlayed.length, medianAbsEquityDifference: sortedDiff[Math.floor(sortedDiff.length / 2)] ?? null,
      errorRows: outcomes.filter((row) => ["ERROR", "BLUNDER"].includes(row.errorSeverity)).length,
      errorCaught: outcomes.filter((row) => ["ERROR", "BLUNDER"].includes(row.errorSeverity) && row.gnubgCallsMistake).length,
      medianMs: outcomes.map((row) => row.elapsedMs).sort((a, b) => a - b)[Math.floor(outcomes.length / 2)],
      all21RollsMs: allRollMs,
    },
    severity: Object.fromEntries(["ERROR", "BLUNDER"].map((severity) => [severity, summarize(outcomes.filter((row) => row.errorSeverity === severity))])),
    disagreements: outcomes.filter((row) => !row.bestAgrees).slice(0, 8),
    unmeasuredPlayedEquity: outcomes.filter((row) => row.playedEquityDifference === null).length,
    outcomes,
  }, null, 2));
  await prismaReadOnly.$disconnect();
}

void main();
