import { analyze, analyzeCube, type Analysis, type CubeAnalysis } from "@/lib/engine/gnubg";

export type EngineRequest =
  | { kind: "checker"; positionId: string; matchId: string; dice: [number, number] }
  | { kind: "cube"; positionId: string; matchId: string };

export type EngineResult =
  | { kind: "checker"; analysis: Analysis }
  | { kind: "cube"; analysis: CubeAnalysis };

export class EngineUnavailableError extends Error {
  constructor() {
    super("Local GNU Backgammon engine is unavailable.");
    this.name = "EngineUnavailableError";
  }
}

export async function analyzePosition(request: EngineRequest): Promise<EngineResult> {
  try {
    if (request.kind === "checker") {
      return { kind: "checker", analysis: await analyze(request.positionId, request.matchId, request.dice) };
    }
    return { kind: "cube", analysis: await analyzeCube(request.positionId, request.matchId) };
  } catch (error) {
    if (error instanceof Error && (error as NodeJS.ErrnoException).code === "ENOENT") throw new EngineUnavailableError();
    if (error instanceof Error && /(?:docker daemon|cannot connect to the docker|unable to find image|pull access denied|no such image)/i.test(error.message)) {
      throw new EngineUnavailableError();
    }
    throw error;
  }
}
