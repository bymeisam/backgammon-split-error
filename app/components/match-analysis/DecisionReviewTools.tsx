"use client";

import Link from "next/link";
import { useState } from "react";
import type { Decision } from "@/lib/mistakes";
import { formatRelativeDue } from "@/lib/review/format";
import type { DecisionReviewStatus } from "@/lib/review/types";
import { useEffectiveReviewCard, useEffectiveTags, useReviewState } from "@/app/providers/ReviewStateProvider";
import TagEditor from "@/app/components/review/TagEditor";
import { style } from "./DecisionReviewTools.styles";

// Next to the note below the board: "Add to review" (or "In review · due
// …", linking to the card on /review/cards) and the decision's tags.
// DB-backed decisions only — no dbDecisionId (the /galaxy pages, or a match
// not in the DB) renders nothing. canEdit is isGalaxyEnabled() from the
// server: without it the review control is hidden and tags are read-only
// (and shown only when there are some). The add button shows only for
// eligible decisions (lib/review/eligibility.ts, worked out on the server).
export default function DecisionReviewTools({ decision, canEdit }: { decision: Decision; canEdit: boolean }) {
  const card = useEffectiveReviewCard(decision);
  const tags = useEffectiveTags(decision);
  const { recordCard } = useReviewState();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const id = decision.dbDecisionId;
  if (id == null) return null;

  const showReview = canEdit && (card !== null || decision.reviewEligible === true);
  if (!showReview && !canEdit && tags.length === 0) return null;

  async function add() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/review/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decisionId: id }),
      });
      const json = (await res.json().catch(() => null)) as
        | (Partial<DecisionReviewStatus> & { error?: string })
        | null;
      if (!res.ok || json?.cardId == null || !json.due) {
        setError(json?.error ?? `Couldn't add to review (HTTP ${res.status}).`);
        return;
      }
      recordCard(id as number, { cardId: json.cardId, due: json.due, suspended: json.suspended ?? false });
    } catch {
      setError("Couldn't add to review (network error).");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div data-testid="decision-review-tools" className={style.card}>
      {showReview && (
        <div className={style.reviewRow}>
          {card ? (
            <Link href={`/review/cards?card=${card.cardId}`} className={style.inReview}>
              In review ·{" "}
              <span suppressHydrationWarning>
                {card.suspended ? "suspended" : `due ${formatRelativeDue(new Date(card.due), new Date())}`}
              </span>
            </Link>
          ) : (
            <button type="button" onClick={add} disabled={busy} className={style.addButton}>
              Add to review
            </button>
          )}
          {error && <span className={style.error}>{error}</span>}
        </div>
      )}
      <TagEditor key={id} dbDecisionId={id} tags={decision.tags} canEdit={canEdit} />
    </div>
  );
}
