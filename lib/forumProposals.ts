import type { ForumCubeAction } from "@/lib/generated/prisma/client";
import { legalSequences } from "@/lib/checkerMoves";
import type { DecodedMatchId } from "@/lib/gnuMatchId";
import { encodeGnuPositionId, type DecodedPosition } from "@/lib/gnuPositionId";

export type CubeAction = ForumCubeAction;
export const CUBE_ACTION_LABELS: Record<CubeAction, string> = {
  NO_DOUBLE: "No double",
  DOUBLE_TAKE: "Double/Take",
  DOUBLE_PASS: "Double/Pass",
  TOO_GOOD: "Too good/Pass",
  TAKE: "Take",
  PASS: "Pass",
};

export interface CheckerProposal {
  notation: string;
  resultPositionId: string;
}

export function validateCheckerProposal(
  position: DecodedPosition,
  dice: readonly number[],
  resultPositionId: string
): CheckerProposal | null {
  try {
    const normalizedDice = dice.length === 2 && dice[0] === dice[1]
      ? [dice[0], dice[0], dice[0], dice[0]]
      : [...dice];
    const legal = legalSequences(position, normalizedDice);
    const matching = legal.find((sequence) => encodeGnuPositionId(sequence.position) === resultPositionId);
    return matching ? { notation: matching.notation, resultPositionId } : null;
  } catch {
    return null;
  }
}

export function cubeActionsFor(match: Pick<DecodedMatchId, "doubleOffered">): CubeAction[] {
  const offered = match.doubleOffered ? ["TAKE", "PASS"] : ["NO_DOUBLE", "DOUBLE_TAKE", "DOUBLE_PASS", "TOO_GOOD"];
  return offered as CubeAction[];
}

export type ProposalTallyItem =
  | { kind: "CHECKER"; resultPositionId: string; count: number }
  | { kind: "CUBE"; cubeAction: CubeAction; count: number };

export type ProposalTallyInput =
  | { kind: "CHECKER"; resultPositionId: string; key: string; proposalId: number; notation: string }
  | { kind: "CUBE"; cubeAction: CubeAction; key: string; proposalId: number };

export function tallyProposals(proposals: readonly ProposalTallyInput[]): ProposalTallyItem[] {
  const tallies = new Map<string, ProposalTallyItem>();
  for (const proposal of proposals) {
    const groupingKey = proposal.kind === "CHECKER"
      ? `CHECKER:${proposal.resultPositionId}`
      : `CUBE:${proposal.cubeAction}`;
    const existing = tallies.get(groupingKey);
    if (existing) {
      existing.count += 1;
    } else if (proposal.kind === "CHECKER") {
      tallies.set(groupingKey, { kind: "CHECKER", resultPositionId: proposal.resultPositionId, count: 1 });
    } else {
      tallies.set(groupingKey, { kind: "CUBE", cubeAction: proposal.cubeAction, count: 1 });
    }
  }
  return [...tallies.values()].sort((a, b) => b.count - a.count);
}
