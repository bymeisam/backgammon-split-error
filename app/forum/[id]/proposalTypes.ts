import type { BoardCube } from "@/lib/boardFrame";
import type { DecodedMatchId } from "@/lib/gnuMatchId";
import type { CubeAction } from "@/lib/forumProposals";
import type { DecodedPosition } from "@/lib/gnuPositionId";
import type { ForumPositionKind } from "@/lib/forumPosition";

export interface ProposalPositionOption {
  id: number;
  label: string;
  kind: ForumPositionKind;
  position: DecodedPosition;
  positionId: string;
  dice: number[];
  match: DecodedMatchId;
  cube: BoardCube;
}

export type ProposalDraftValue =
  | { kind: "CHECKER"; positionId: number; notation: string; resultPositionId: string }
  | { kind: "CUBE"; positionId: number; cubeAction: CubeAction };

export type ReplyProposalViewModel =
  | { kind: "CHECKER"; key: string; positionLabel: string; notation: string; position: DecodedPosition; dice: number[]; cube: BoardCube; resultPositionId: string }
  | { kind: "CUBE"; key: string; positionLabel: string; cubeAction: CubeAction; position: DecodedPosition; cube: BoardCube };

export interface ProposalTallyViewModel {
  key: string;
  proposalId: number;
  count: number;
  proposal: ReplyProposalViewModel;
}
