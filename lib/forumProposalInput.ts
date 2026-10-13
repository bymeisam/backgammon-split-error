import type { ForumCubeAction } from "@/lib/generated/prisma/client";
import { CUBE_ACTION_LABELS, cubeActionsFor, validateCheckerProposal } from "@/lib/forumProposals";
import { decodeForumPosition } from "@/lib/forumPosition";

export type ValidatedProposal =
  | { studyPositionId: number; resultPositionId: string; notation: string; cubeAction: null }
  | { studyPositionId: number; resultPositionId: null; notation: null; cubeAction: ForumCubeAction };

type AttachedPosition = { studyPositionId: number; studyPosition: { id: number; positionId: string; gnuMatchId: string; kind: "CHECKER" | "CUBE" } };

export function validateReplyProposals(input: unknown, positions: readonly AttachedPosition[]): ValidatedProposal[] | null {
  if (!Array.isArray(input)) return null;
  const attached = new Map(positions.map(({ studyPositionId, studyPosition }) => [studyPositionId, studyPosition]));
  const seen = new Set<number>();
  const validated: ValidatedProposal[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const proposal = item as Record<string, unknown>;
    if (!Number.isInteger(proposal.studyPositionId) || seen.has(proposal.studyPositionId as number)) return null;
    const studyPositionId = proposal.studyPositionId as number;
    const stored = attached.get(studyPositionId);
    if (!stored) return null;
    seen.add(studyPositionId);
    if (stored.kind === "CHECKER") {
      if (typeof proposal.resultPositionId !== "string" || "cubeAction" in proposal) return null;
      const decoded = decodeForumPosition(stored.positionId, stored.gnuMatchId, stored.kind);
      if (!decoded) return null;
      const result = validateCheckerProposal(decoded.position, decoded.dice, proposal.resultPositionId);
      if (!result) return null;
      validated.push({ studyPositionId, ...result, cubeAction: null });
    } else {
      if (typeof proposal.cubeAction !== "string" || "resultPositionId" in proposal) return null;
      if (!(proposal.cubeAction in CUBE_ACTION_LABELS)) return null;
      const decoded = decodeForumPosition(stored.positionId, stored.gnuMatchId, stored.kind);
      if (!decoded || !cubeActionsFor(decoded.match).includes(proposal.cubeAction as ForumCubeAction)) return null;
      validated.push({ studyPositionId, resultPositionId: null, notation: null, cubeAction: proposal.cubeAction as ForumCubeAction });
    }
  }
  return validated;
}
