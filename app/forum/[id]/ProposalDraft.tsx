"use client";

import { useState } from "react";
import Button from "@/app/components/ui/Button";
import CheckerMoveExplorer from "@/app/components/match-analysis/CheckerMoveExplorer";
import { CUBE_ACTION_LABELS, cubeActionsFor, validateCheckerProposal } from "@/lib/forumProposals";
import type { ProposalDraftValue, ProposalPositionOption } from "./proposalTypes";
import { style } from "../forum.styles";

export default function ProposalDraft({
  position,
  value,
  onChange,
}: {
  position: ProposalPositionOption;
  value: ProposalDraftValue | null;
  onChange: (proposal: ProposalDraftValue | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [checkerResult, setCheckerResult] = useState<{ position: ProposalPositionOption["position"]; resultPositionId: string | null; status: "ready" | "complete" | "no-legal-move" } | null>(null);
  const selectedAction = value?.kind === "CUBE" ? value.cubeAction : null;

  return (
    <div className={style.proposalDraft}>
      {!open && !value && <Button size="compact" onClick={() => setOpen(true)}>Propose this move</Button>}
      {open && (
        <div className={style.proposalField}>
          <p className={style.proposalLabel}>Proposal for {position.label}</p>
          {position.kind === "CHECKER" ? (
            <>
              <CheckerMoveExplorer
                position={position.position}
                dice={position.dice}
                cube={position.cube}
                onChange={setCheckerResult}
              />
              {checkerResult?.status === "complete" && checkerResult.resultPositionId && (
                <Button
                  size="compact"
                  onClick={() => {
                    if (checkerResult?.status !== "complete" || !checkerResult.resultPositionId) return;
                    const proposal = validateCheckerProposal(position.position, position.dice, checkerResult.resultPositionId);
                    if (proposal) onChange({ kind: "CHECKER", positionId: position.id, ...proposal });
                  }}
                >
                  Use this play
                </Button>
              )}
            </>
          ) : (
            <div className={style.proposalOptions} role="group" aria-label={`Cube action for ${position.label}`}>
              {cubeActionsFor(position.match).map((action) => (
                <Button
                  key={action}
                  size="compact"
                  variant={selectedAction === action ? "primary" : "secondary"}
                  aria-pressed={selectedAction === action}
                  onClick={() => onChange({ kind: "CUBE", positionId: position.id, cubeAction: action })}
                >
                  {CUBE_ACTION_LABELS[action]}
                </Button>
              ))}
            </div>
          )}
          <div className={style.proposalOptions}>
            {value && <Button size="compact" onClick={() => onChange(null)}>Remove proposal</Button>}
            <Button size="compact" onClick={() => setOpen(false)}>Close proposal controls</Button>
          </div>
        </div>
      )}
      {value && !open && (
        <div className={style.proposalChipList}>
          <span className={style.proposalChip}>
            {position.label} · {value.kind === "CHECKER" ? <span className={style.proposalChecker}>{value.notation}</span> : CUBE_ACTION_LABELS[value.cubeAction]}
          </span>
          <Button size="compact" onClick={() => onChange(null)}>Remove proposal</Button>
        </div>
      )}
    </div>
  );
}
