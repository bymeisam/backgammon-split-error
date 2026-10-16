import { spawn } from "node:child_process";
import { decodeGnuMatchId } from "@/lib/gnuMatchId";
import { decodeGnuPositionId } from "@/lib/gnuPositionId";

export const GNUBG_IMAGE = "bg-gnubg:1.07.001";
export const EVALUATION_PLIES = 2;
// GNU Backgammon 1.07.001's default 2-ply move-filter threshold, confirmed by `show evaluation`.
export const MOVE_FILTER_THRESHOLD = 0.16;

export type Candidate = {
  rank: number;
  move: string;
  equity: number;
  plies: number;
  probabilities: { win: number; winGammon: number; winBackgammon: number; lose: number; loseGammon: number; loseBackgammon: number } | null;
};
export type Analysis = { positionId: string; roll: [number, number]; plies: number; depthReason?: "single-survivor"; candidates: Candidate[] };

const candidateLine = /^\s*(\d+)\.\s+Cubeful\s+(\d+)-ply\s+(.+?)\s+Eq\.:\s*([+-]?[\d.]+)(?:\s+\([^)]+\))?\s*$/;
const probabilityLine = /^\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+-\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*$/;

function standardMoveNotation(move: string): string {
  return move.split(/\s+/).flatMap((token) => {
    const part = /^([^/]+)\/([^*()]+)(\*)?(?:\((\d+)\))?$/.exec(token);
    if (!part) return [token];
    const repeats = Number(part[4] ?? 1);
    return Array.from({ length: repeats }, (_, index) => `${part[1]}/${part[2]}${index === 0 ? part[3] ?? "" : ""}`);
  }).join(" ");
}

export function parseHints(output: string, expectedPlies = EVALUATION_PLIES, moveFilterThreshold = MOVE_FILTER_THRESHOLD): Candidate[][] {
  const groups: Candidate[][] = [];
  for (const line of output.split(/\r?\n/)) {
    const match = candidateLine.exec(line);
    if (match) {
      if (Number(match[1]) === 1) groups.push([]);
      groups.at(-1)?.push({ rank: Number(match[1]), plies: Number(match[2]), move: standardMoveNotation(match[3].trim()), equity: Number(match[4]), probabilities: null });
      continue;
    }
    const probs = probabilityLine.exec(line);
    if (probs && groups.at(-1)?.length) {
      groups.at(-1)![groups.at(-1)!.length - 1].probabilities = {
        win: Number(probs[1]), winGammon: Number(probs[2]), winBackgammon: Number(probs[3]),
        lose: Number(probs[4]), loseGammon: Number(probs[5]), loseBackgammon: Number(probs[6]),
      };
    }
  }
  const hints = output.split(/(?=^\s*1\.\s+Cubeful)/m);
  for (const [index, group] of groups.entries()) {
    if (!group.length) continue;
    const singleSurvivor =
      expectedPlies === EVALUATION_PLIES &&
      group[0]?.plies === 0 &&
      group.every(({ plies }) => plies === 0) &&
      group.length >= 2 &&
      (group[0].equity - group[1].equity > moveFilterThreshold);
    if (group[0]?.plies !== expectedPlies && !singleSurvivor) {
      const candidates = group.map(({ rank, plies, move }) => `${rank}:${plies}-ply ${move}`).join("; ");
      throw new Error(`roll index ${index}; gnubg best candidate was ${group[0]?.plies ?? "missing"}-ply; expected ${expectedPlies}-ply; candidates: ${candidates}; raw hint:\n${hints[index + 1] ?? output}`);
    }
  }
  return groups;
}

export function parseHint(output: string, expectedPlies = EVALUATION_PLIES, moveFilterThreshold = MOVE_FILTER_THRESHOLD): Candidate[] {
  return parseHints(output, expectedPlies, moveFilterThreshold)[0] ?? [];
}

function commands(positionId: string, matchId: string, rolls: [number, number][], plies = EVALUATION_PLIES, moveFilterThreshold?: number): string {
  decodeGnuPositionId(positionId);
  if (!decodeGnuMatchId(matchId)) throw new Error("Invalid GNU Match ID");
  return [
    "new game",
    `set matchid ${matchId}`,
    `set evaluation chequerplay evaluation plies ${plies}`,
    ...(moveFilterThreshold === undefined ? [] : [`set evaluation movefilter ${plies} 0 0 8 ${moveFilterThreshold}`]),
    ...rolls.flatMap(([high, low]) => [`set board ${positionId}`, `set dice ${high} ${low}`, "hint"]),
    "quit",
    "",
  ].join("\n");
}

async function run(input: string): Promise<string> {
  const { promise, resolve, reject } = Promise.withResolvers<string>();
  const child = spawn("docker", ["run", "--rm", "-i", GNUBG_IMAGE, "/usr/games/gnubg", "-t", "-q"], { stdio: ["pipe", "pipe", "pipe"] });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8").on("data", (chunk: string) => { stdout += chunk; });
  child.stderr.setEncoding("utf8").on("data", (chunk: string) => { stderr += chunk; });
  child.on("error", reject);
  child.on("close", (code) => code === 0 ? resolve(stdout) : reject(new Error(`gnubg Docker exited ${code}: ${stderr}`)));
  child.stdin.end(input);
  return promise;
}

export async function timeEmptyRun(): Promise<number> {
  const started = performance.now();
  await run("quit\n");
  return performance.now() - started;
}

async function evaluateMany(positionId: string, matchId: string, rolls: [number, number][], plies = EVALUATION_PLIES, moveFilterThreshold?: number): Promise<Analysis[]> {
  const input = commands(positionId, matchId, rolls, plies, moveFilterThreshold);
  const output = await run(input);
  const groups = parseHints(output, plies, moveFilterThreshold ?? MOVE_FILTER_THRESHOLD);
  let insertedEmptyGroups = 0;
  for (const noLegalMove of output.matchAll(/There are no legal moves\./g)) {
    const prefix = output.slice(0, noLegalMove.index);
    const index = (prefix.match(/^\s*1\.\s+Cubeful/gm) ?? []).length + insertedEmptyGroups;
    groups.splice(index, 0, []);
    insertedEmptyGroups++;
  }
  if (groups.length !== rolls.length) {
    throw new Error(`gnubg returned ${groups.length - insertedEmptyGroups} candidate analyses and ${insertedEmptyGroups} no-legal-move results for ${rolls.length} requested rolls; output:\n${output}`);
  }
  return groups.map((candidates, index) => ({
    positionId,
    roll: rolls[index],
    plies,
    ...(plies === EVALUATION_PLIES && candidates[0]?.plies === 0 ? { depthReason: "single-survivor" as const } : {}),
    candidates,
  }));
}

export async function analyzeAtPlies(positionId: string, matchId: string, requestedRoll: [number, number], plies: number, moveFilterThreshold?: number): Promise<Analysis> {
  const match = decodeGnuMatchId(matchId);
  if (!match) throw new Error("Invalid GNU Match ID");
  if (requestedRoll.some((die) => !Number.isInteger(die) || die < 1 || die > 6)) throw new Error("Roll must contain two dice from 1 to 6");
  if (!Number.isInteger(plies) || plies < 0 || plies > 4) throw new Error("Plies must be an integer from 0 to 4");
  if (moveFilterThreshold !== undefined && (!Number.isFinite(moveFilterThreshold) || moveFilterThreshold <= 0)) throw new Error("Move-filter threshold must be positive");
  const roll = [...requestedRoll].sort((a, b) => b - a) as [number, number];
  return (await evaluateMany(positionId, matchId, [roll], plies, moveFilterThreshold))[0];
}

export async function analyze(positionId: string, matchId: string, requestedRoll?: [number, number]): Promise<Analysis> {
  const match = decodeGnuMatchId(matchId);
  if (!match) throw new Error("Invalid GNU Match ID");
  const inputRoll = requestedRoll ?? match.dice;
  if (inputRoll.some((die) => !Number.isInteger(die) || die < 1 || die > 6)) throw new Error("Roll must contain two dice from 1 to 6");
  const roll = [...inputRoll].sort((a, b) => b - a) as [number, number];
  return (await evaluateMany(positionId, matchId, [roll]))[0];
}

export async function allRolls(positionId: string, matchId: string): Promise<Analysis[]> {
  if (!decodeGnuMatchId(matchId)) throw new Error("Invalid GNU Match ID");
  const rolls: [number, number][] = [];
  for (let high = 1; high <= 6; high++) for (let low = 1; low <= high; low++) rolls.push([high, low]);
  return evaluateMany(positionId, matchId, rolls);
}

