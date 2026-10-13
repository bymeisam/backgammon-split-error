"use client";
import { useId, useState } from "react";
import Button from "@/app/components/ui/Button";
import { Table, TableBody, TableCell, TableHead, TableHeadCell, TableRow } from "@/app/components/ui/Table";
import { formatEquity, formatLoss } from "@/lib/review/format";
import type { ForumCubeCell, ForumDecisionAnalysis } from "@/lib/forumAnalysis";
import { style } from "../forum.styles";

const CUBE_CELLS: { key: ForumCubeCell; label: string }[] = [
  { key: "nd", label: "No double" },
  { key: "dt", label: "Double / Take" },
  { key: "dp", label: "Double / Pass" },
];

// The engine analysis under a game-sourced position on a forum post, hidden
// until "Show analysis" is pressed (per view; nothing is stored). It gets
// lib/forumAnalysis.ts's sanitized analysis only: the options or cube
// equities and the best action, never what was played in the game.
export default function DecisionAnalysisPanel({ analysis }: { analysis: ForumDecisionAnalysis }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <div className={style.analysis}>
      <div className={style.analysisHeader}>
        <span className={style.analysisLabel}>Engine analysis</span>
        <Button size="compact" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((value) => !value)}>
          {open ? "Hide analysis" : "Show analysis"}
        </Button>
      </div>
      {open && (
        <div id={panelId} data-testid="forum-analysis">
          {analysis.kind === "checker" ? (
            <Table className={style.analysisTable}>
              <TableHead>
                <TableHeadCell>#</TableHeadCell>
                <TableHeadCell>Move</TableHeadCell>
                <TableHeadCell numeric className={style.analysisNumberHead}>
                  Equity
                </TableHeadCell>
                <TableHeadCell numeric className={style.analysisNumberHead}>
                  Loss
                </TableHeadCell>
              </TableHead>
              <TableBody>
                {analysis.options.map((option, index) => {
                  const isBest = index === 0;
                  return (
                    <TableRow key={`${index}-${option.move}`} className={style.analysisRow(isBest)}>
                      <TableCell kind="muted" className={style.analysisRankCell(isBest)}>
                        {index + 1}
                      </TableCell>
                      <TableCell className={style.analysisMove}>
                        {option.move}
                        {isBest && <span className={style.analysisBestTag}>Best</span>}
                      </TableCell>
                      <TableCell kind="numeric" className={style.analysisNumber}>
                        {formatEquity(option.equity)}
                      </TableCell>
                      <TableCell kind="numeric" className={style.analysisNumber}>
                        {formatLoss(option.loss)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className={style.analysisCube}>
              <p className={style.analysisBest}>
                Best: <span className={style.analysisBestLabel}>{analysis.best}</span>
                {analysis.bestDetail && <span className={style.analysisBestDetail}> · {analysis.bestDetail}</span>}
              </p>
              <div className={style.analysisEquities} aria-label="Cube equities, doubler's view">
                {CUBE_CELLS.map(({ key, label }) => {
                  const isBest = key === analysis.bestCell;
                  return (
                    <div key={key} className={style.analysisEquityCell(isBest)}>
                      <span className={style.analysisEquityLabel(isBest)}>
                        {label}
                        {isBest && <span className={style.analysisEquityBestTag}>Best</span>}
                      </span>
                      <span className={style.analysisEquityValue}>{formatEquity(analysis[key])}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
