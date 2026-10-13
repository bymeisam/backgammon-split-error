"use client";

import { useId, useState } from "react";
import Board from "@/app/components/match-analysis/Board";
import Button from "@/app/components/ui/Button";
import Modal from "@/app/components/ui/Modal";
import { decodeGnuPositionId } from "@/lib/gnuPositionId";
import type { ProposalTallyViewModel, ReplyProposalViewModel } from "./proposalTypes";
import { style } from "../forum.styles";

const CUBE_ACTION_LABELS: Record<Extract<ReplyProposalViewModel, { kind: "CUBE" }>["cubeAction"], string> = {
  TAKE: "Take",
  PASS: "Pass",
  NO_DOUBLE: "No double",
  DOUBLE_TAKE: "Double · opponent take",
  DOUBLE_PASS: "Double · opponent pass",
  TOO_GOOD: "Too good to double",
};

function ProposalPreview({ proposal }: { proposal: ReplyProposalViewModel }) {
  const [open, setOpen] = useState(false);
  const headingId = useId();
  const action = proposal.kind === "CHECKER" ? proposal.notation : CUBE_ACTION_LABELS[proposal.cubeAction];
  const previewPosition = proposal.kind === "CHECKER"
    ? (() => {
        try {
          return decodeGnuPositionId(proposal.resultPositionId);
        } catch {
          return null;
        }
      })()
    : proposal.position;

  return (
    <>
      <Button size="compact" className={style.proposalChip} onClick={() => setOpen(true)} aria-label={`${proposal.positionLabel}: ${action}`}>
        {proposal.positionLabel} · {proposal.kind === "CHECKER" ? <span className={style.proposalChecker}>{proposal.notation}</span> : action}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} labelledBy={headingId}>
        <h2 id={headingId} className={style.modalHeading}>{proposal.positionLabel} · {action}</h2>
        <p className={style.proposalModalText}>{proposal.kind === "CHECKER" ? "Position after the proposed play" : "Position for the proposed cube action"}</p>
        {previewPosition && (
          <div className={style.proposalBoard}>
            <Board decoded={previewPosition} roll={[]} cube={proposal.cube} />
          </div>
        )}
        {!previewPosition && <p className={style.proposalModalText}>The resulting position is unavailable.</p>}
        <div className={style.proposalDismiss}>
          <Button onClick={() => setOpen(false)}>Close</Button>
        </div>
      </Modal>
    </>
  );
}

export function ReplyProposalChip({ proposal }: { proposal: ReplyProposalViewModel }) {
  return <span className={style.proposalChipList}><ProposalPreview proposal={proposal} /></span>;
}

export default function PositionProposalTally({ proposals }: { proposals: ProposalTallyViewModel[] }) {
  if (proposals.length === 0) return null;
  const count = proposals.reduce((total, item) => total + item.count, 0);
  return (
    <details className={style.proposalTally}>
      <summary className={style.proposalTallySummary}>Show proposals ({count})</summary>
      <div className={style.proposalTallyList}>
        {proposals.map((item) => (
          <div className={style.proposalTallyRow} key={item.key}>
            <ProposalPreview proposal={item.proposal} />
            <span className={style.proposalCount}>{item.count}</span>
          </div>
        ))}
      </div>
    </details>
  );
}
