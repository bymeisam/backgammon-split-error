"use client";

import { useId, useState } from "react";
import Board from "@/app/components/match-analysis/Board";
import Button from "@/app/components/ui/Button";
import Modal from "@/app/components/ui/Modal";
import { decodeGnuPositionId } from "@/lib/gnuPositionId";
import { CUBE_ACTION_LABELS } from "@/lib/forumProposals";
import type { ProposalTallyViewModel, ReplyProposalViewModel } from "./proposalTypes";
import { style } from "../forum.styles";

function WrappedPositionLabel({ label }: { label: string }) {
  return (
    <span className={style.proposalPosition}>
      {label.split(" · ").map((segment, index) => (
        <span className={style.proposalPositionSegment} key={`${index}-${segment}`}>
          {index > 0 && " · "}
          {segment}
        </span>
      ))}
    </span>
  );
}

function ProposalPreview({ proposal }: { proposal: ReplyProposalViewModel }) {
  const [open, setOpen] = useState(false);
  const headingId = useId();
  if (proposal.kind === "CUBE") {
    return (
      <span className={style.proposalChip}>
        <WrappedPositionLabel label={proposal.positionLabel} />
        <span className={style.proposalCubeAction}>· {CUBE_ACTION_LABELS[proposal.cubeAction]}</span>
      </span>
    );
  }
  const action = proposal.notation;
  let previewPosition;
  try {
    previewPosition = decodeGnuPositionId(proposal.resultPositionId);
  } catch {
    previewPosition = null;
  }

  return (
    <>
      <Button size="compact" className={style.proposalInteractiveChip} onClick={() => setOpen(true)} aria-label={`${proposal.positionLabel}: ${action}`}>
        <WrappedPositionLabel label={proposal.positionLabel} />
        <span className={style.proposalCheckerMove}>
          <span className={style.proposalSeparator}>·</span>
          <span className={style.proposalChecker}>{proposal.notation}</span>
        </span>
        <span aria-hidden="true" className={style.proposalView}>↗</span>
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} labelledBy={headingId}>
        <h2 id={headingId} className={style.modalHeading}>{proposal.positionLabel} · {action}</h2>
        <p className={style.proposalModalText}>Position after the proposed play</p>
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
            <span className={style.proposalTallyChip}>
              <ProposalPreview proposal={item.proposal} />
            </span>
            <span className={style.proposalCount}>{item.count} {item.count === 1 ? "vote" : "votes"}</span>
          </div>
        ))}
      </div>
    </details>
  );
}
