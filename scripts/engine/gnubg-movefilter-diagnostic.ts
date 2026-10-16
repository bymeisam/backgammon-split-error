import "dotenv/config";
import { localDbUrl } from "@/lib/databaseUrl";
import { prismaReadOnly } from "@/lib/prisma";
import { getDecisionAnalysis } from "@/lib/analysis";
import { galaxyReview } from "@/lib/analysis/galaxyFields";
import { decodeGnuMatchId } from "@/lib/gnuMatchId";
import { decodeGnuPositionId } from "@/lib/gnuPositionId";
import { analyze, analyzeAtPlies, MOVE_FILTER_THRESHOLD } from "@/lib/engine/gnubg";

async function main() {
  const dbUrl = localDbUrl("ro");
  if (!dbUrl) throw new Error("Local read-only database URL is not configured");
  const url = new URL(dbUrl);
  if (!["localhost", "127.0.0.1"].includes(url.hostname) || decodeURIComponent(url.username) !== "bg_db_ro") {
    throw new Error("Evaluation requires the local read-only database URL using bg_db_ro");
  }

  const rows = await prismaReadOnly.decision.findMany({
    where: {
      kind: "CHECKER", countAsDecision: true, rawError: { not: null }, sourcePositionId: { not: null },
      classification: { in: ["opening_game", "middle_game", "race"] }, game: { match: { source: "galaxy" } },
    },
    select: { id: true, sourcePositionId: true, classification: true, raw: true },
    orderBy: { id: "desc" }, take: 6000,
  });
  const eligible = [] as { id: number; positionId: string; matchId: string; phase: string; dice: [number, number] }[];
  for (const row of rows) {
    const analysis = getDecisionAnalysis({ source: "galaxy", raw: row.raw });
    if (!analysis || analysis.kind !== "checker") continue;
    const matchId = galaxyReview(row.raw)?.source_match?.formatted_value;
    if (typeof matchId !== "string") continue;
    let position;
    try { position = decodeGnuPositionId(row.sourcePositionId!); } catch { continue; }
    const match = decodeGnuMatchId(matchId);
    if (!match) continue;
    const phase = position.mineOff + position.opponentOff >= 10 ? "bear-off" : row.classification === "opening_game" ? "opening" : "middle game";
    eligible.push({ id: row.id, positionId: row.sourcePositionId!, matchId, phase, dice: match.dice });
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
  const sample = [] as typeof eligible;
  for (const [phase, count] of [["opening", 55], ["middle game", 75], ["bear-off", 70]] as const) {
    sample.push(...shuffle(eligible.filter((row) => row.phase === phase)).slice(0, count));
  }
  if (sample.length < 180) throw new Error(`Only ${sample.length} decisions available; wanted about 200`);

  const results = [] as { id: number; phase: string; positionId: string; matchId: string; roll: string; rank1: number; rank2: number | null; gap: number | null; withinThreshold: number; defaultRank1Plies: number | null }[];
  for (const row of sample) {
    const roll = [...row.dice].sort((a, b) => b - a) as [number, number];
    const zero = await analyzeAtPlies(row.positionId, row.matchId, roll, 0);
    let defaultRank1Plies: number | null = null;
    try { defaultRank1Plies = (await analyze(row.positionId, row.matchId, roll)).candidates[0]?.plies ?? null; }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes("best candidate was")) throw error;
    }
    const rank1 = zero.candidates[0]?.equity;
    const rank2 = zero.candidates[1]?.equity;
    results.push({
      id: row.id, phase: row.phase, positionId: row.positionId, matchId: row.matchId, roll: roll.join("-"),
      rank1: rank1 ?? NaN, rank2: rank2 ?? null, gap: rank1 !== undefined && rank2 !== undefined ? rank1 - rank2 : null,
      withinThreshold: rank1 === undefined ? 0 : zero.candidates.filter((candidate) => rank1 - candidate.equity <= MOVE_FILTER_THRESHOLD).length,
      defaultRank1Plies,
    });
    if (results.length % 10 === 0) console.log(`Measured ${results.length}/${sample.length}`);
  }

  const middle = sample[Math.floor(sample.length / 2)];
  let roll21: unknown;
  const started = performance.now();
  try { roll21 = await analyzeAtPlies(middle.positionId, middle.matchId, [2, 2], 0); }
  catch (error) { roll21 = { error: error instanceof Error ? error.message : String(error) }; }
  const accepted = results.filter((row) => row.defaultRank1Plies === 2);
  const rejected = results.filter((row) => row.defaultRank1Plies !== 2);
  const acceptedGaps = accepted.flatMap((row) => row.gap === null ? [] : [row.gap]).sort((a, b) => a - b);
  console.log(JSON.stringify({
    config: { plies: 2, threshold: MOVE_FILTER_THRESHOLD, sampleSize: sample.length },
    accepted: {
      n: accepted.length,
      withTwoWithinThreshold: accepted.filter((row) => row.withinThreshold >= 2).length,
      gap: { n: acceptedGaps.length, min: acceptedGaps[0] ?? null, median: acceptedGaps.length ? acceptedGaps[Math.floor(acceptedGaps.length / 2)] : null, max: acceptedGaps.at(-1) ?? null },
      rows: accepted,
    },
    rejected: { n: rejected.length, allGapAboveThreshold: rejected.every((row) => row.gap !== null && row.gap > MOVE_FILTER_THRESHOLD), rows: rejected },
    roll21: { elapsedMs: performance.now() - started, result: roll21 },
  }, null, 2));
  await prismaReadOnly.$disconnect();
}

void main();
