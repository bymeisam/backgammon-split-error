"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { style } from "./reviewCards.styles";

// Suspend / unsuspend and delete for one card on /review/cards (write mode
// only — the page doesn't render this otherwise, and the routes are gated
// by proxy.ts). Delete asks first: it removes the card's review history too.
export default function CardActions({ cardId, suspended }: { cardId: number; suspended: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(init: RequestInit) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/review/cards/${cardId}`, init);
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(json?.error ?? `Failed (HTTP ${res.status}).`);
        return;
      }
      setConfirming(false);
      router.refresh();
    } catch {
      setError("Failed (network error).");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={style.actions}>
      <button
        type="button"
        disabled={busy}
        onClick={() =>
          send({
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ suspended: !suspended }),
          })
        }
        className={style.actionButton}
      >
        {suspended ? "Unsuspend" : "Suspend"}
      </button>
      <button type="button" disabled={busy} onClick={() => setConfirming(true)} className={style.deleteButton}>
        Delete
      </button>
      {error && <span className={style.errorText}>{error}</span>}

      {confirming && (
        <div className={style.modalOverlay} role="dialog" aria-modal="true" aria-labelledby={`delete-${cardId}`}>
          <div data-testid="delete-card-dialog" className={style.modalPanel}>
            <h2 id={`delete-${cardId}`} className={style.modalHeading}>
              Delete this card?
            </h2>
            <p className={style.modalText}>
              Its review history goes with it. The decision, its note and its tags stay.
            </p>
            <div className={style.modalButtons}>
              <button type="button" onClick={() => setConfirming(false)} className={style.modalSecondaryButton}>
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => send({ method: "DELETE" })}
                className={style.modalPrimaryButton}
              >
                {busy ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
