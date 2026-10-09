"use client";

import Link from "next/link";
import { useState } from "react";
import type { Decision } from "@/lib/mistakes";
import { formatRelativeDue } from "@/lib/review/format";
import type { DecisionReviewStatus } from "@/lib/review/types";
import { useEffectiveReviewCard, useEffectiveTags, useReviewState } from "@/app/providers/ReviewStateProvider";
import TagEditor from "@/app/components/review/TagEditor";
import DecisionNote from "./DecisionNote";
import { style } from "./DecisionReviewTools.styles";

// The note card below the board (BoardPanel): the note itself
// (DecisionNote), "Add to review" in its head (or "In review ✓", linking to
// the card on /review/cards), and the decision's tags in its foot.
// DB-backed decisions only — no dbDecisionId (the /sources/galaxy pages, or a match
// not in the DB) renders nothing. canEdit is isGalaxyEnabled() from the
// server: without it the review control is hidden, the note and tags are
// read-only, and the card shows only when there's a note or a tag. The add
// button shows only for eligible decisions (lib/review/eligibility.ts,
// worked out on the server).
export default function DecisionReviewTools({
  decision,
  canEdit,
  placeholder,
  inset = false,
}: {
  decision: Decision;
  canEdit: boolean;
  placeholder?: string;
  // Inset from the screen edge below md (a page without side padding there).
  inset?: boolean;
}) {
  const card = useEffectiveReviewCard(decision);
  const tags = useEffectiveTags(decision);
  const { recordCard } = useReviewState();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const id = decision.dbDecisionId;
  if (id == null) return null;

  const showReview = canEdit && (card !== null || decision.reviewEligible === true);

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

  const reviewControl = showReview ? (
    <div data-testid="decision-review-tools" className={style.reviewRow}>
      {error && <span className={style.error}>{error}</span>}
      {card ? (
        <Link
          href={`/review/cards?card=${card.cardId}`}
          className={style.inReview}
          title={card.suspended ? "In review, suspended" : undefined}
        >
          In review ✓
          {/* The due time, as a tooltip-sized aside. */}
          <span className={style.srOnly} suppressHydrationWarning>
            {card.suspended ? " (suspended)" : ` (due ${formatRelativeDue(new Date(card.due), new Date())})`}
          </span>
        </Link>
      ) : (
        <button type="button" onClick={add} disabled={busy} className={style.addButton}>
          Add to review
        </button>
      )}
    </div>
  ) : null;

  return (
    <DecisionNote
      key={id}
      note={decision.note}
      dbDecisionId={id}
      canEditNotes={canEdit}
      placeholder={placeholder}
      inset={inset}
      headAction={reviewControl}
      hasTags={tags.length > 0}
      tags={<TagEditor key={id} dbDecisionId={id} tags={decision.tags} canEdit={canEdit} />}
    />
  );
}
