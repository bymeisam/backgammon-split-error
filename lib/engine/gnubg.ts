import { spawn } from "node:child_process";
import { decodeGnuMatchId } from "@/lib/gnuMatchId";
import { decodeGnuPositionId } from "@/lib/gnuPositionId";

export const GNUBG_IMAGE = "omp-gnubg:1.07.001";
export const EVALUATION_PLIES = 0;

export type Candidate = {
  rank: number;
  move: string;
  equity: number;
  probabilities: { win: number; winGammon: number; winBackgammon: number; lose: number; loseGammon: number; loseBackgammon: number } | null;
};
export type Analysis = { positionId: string; roll: [number, number]; plies: number; candidates: Candidate[] };

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

export function parseHints(output: string): Candidate[][] {
  const groups: Candidate[][] = [];
  for (const line of output.split(/\r?\n/)) {
    const match = candidateLine.exec(line);
    if (match) {
      if (Number(match[2]) !== EVALUATION_PLIES) {
        throw new Error(`gnubg returned ${match[2]}-ply output; expected ${EVALUATION_PLIES}-ply`);
      }
      if (Number(match[1]) === 1) groups.push([]);
      groups.at(-1)?.push({ rank: Number(match[1]), move: standardMoveNotation(match[3].trim()), equity: Number(match[4]), probabilities: null });
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
  return groups;
}

export function parseHint(output: string): Candidate[] {
  return parseHints(output)[0] ?? [];
}

function commands(positionId: string, matchId: string, rolls: [number, number][]): string {
  decodeGnuPositionId(positionId);
  if (!decodeGnuMatchId(matchId)) throw new Error("Invalid GNU Match ID");
  return [
    "new game",
    `set matchid ${matchId}`,
    `set evaluation chequerplay evaluation plies ${EVALUATION_PLIES}`,
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

async function evaluateMany(positionId: string, matchId: string, rolls: [number, number][]): Promise<Analysis[]> {
  const groups = parseHints(await run(commands(positionId, matchId, rolls)));
  if (groups.length !== rolls.length || groups.some((candidates) => !candidates.length)) {
    throw new Error(`gnubg returned ${groups.length} analyses for ${rolls.length} requested rolls`);
  }
  return groups.map((candidates, index) => ({ positionId, roll: rolls[index], plies: EVALUATION_PLIES, candidates }));
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

