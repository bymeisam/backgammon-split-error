"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { bulkConfirmText } from "@/lib/review/bulk";
import { BULK_ADD_CAP } from "@/lib/settings";
import type { BulkAddResponse } from "@/lib/review/types";
import Modal from "@/app/components/ui/Modal";
import { style } from "./mistakes.styles";

type Step =
  | { kind: "idle" }
  | { kind: "counting" }
  | { kind: "confirm"; plan: BulkAddResponse }
  | { kind: "adding"; plan: BulkAddResponse }
  | { kind: "done"; result: BulkAddResponse }
  | { kind: "error"; message: string };

// "Add all to review" for /mistakes' current filter (page-local, only with
// write mode on and a filter set). One dry-run request for the exact counts
// (the confirmation), then one request that adds them in one transaction
// (app/api/review/bulk): up to BULK_ADD_CAP decisions in the list's order,
// skipping ones already in review and ineligible ones. Refreshes the page
// afterwards so the boards show "In review".
export default function BulkAddToReview({
  phase,
  category,
  severity,
}: {
  phase: string | undefined;
  category: string | undefined;
  severity: string | undefined;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>({ kind: "idle" });

  async function call(dryRun: boolean): Promise<BulkAddResponse | string> {
    try {
      const res = await fetch("/api/review/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phase, category, severity, dryRun }),
      });
      const json = (await res.json().catch(() => null)) as (BulkAddResponse & { error?: string }) | null;
      if (!res.ok || !json) return json?.error ?? `Request failed (HTTP ${res.status}).`;
      return json;
    } catch {
      return "Request failed (network error).";
    }
  }

  async function start() {
    setStep({ kind: "counting" });
    const plan = await call(true);
    setStep(typeof plan === "string" ? { kind: "error", message: plan } : { kind: "confirm", plan });
  }

  async function confirm(plan: BulkAddResponse) {
    setStep({ kind: "adding", plan });
    const result = await call(false);
    if (typeof result === "string") {
      setStep({ kind: "error", message: result });
      return;
    }
    setStep({ kind: "done", result });
    router.refresh();
  }

  const close = () => setStep({ kind: "idle" });
  const open = step.kind !== "idle" && step.kind !== "counting";

  return (
    <>
      <button
        type="button"
        onClick={start}
        disabled={step.kind === "counting"}
        className={style.bulkAddButton}
      >
        {step.kind === "counting" ? "Counting…" : "Add all to review"}
      </button>

      <Modal
        open={open}
        // Esc or a backdrop click closes it, except while adding.
        dismissible={step.kind !== "adding"}
        onClose={close}
        labelledBy="bulk-add-title"
        testId="bulk-add-dialog"
      >
        <h2 id="bulk-add-title" className={style.modalHeading}>
          Add to review
        </h2>
        {step.kind === "error" && <p className={style.modalError}>{step.message}</p>}
        {(step.kind === "confirm" || step.kind === "adding") && (
          <p className={style.modalText}>{bulkConfirmText(step.plan, BULK_ADD_CAP)}</p>
        )}
        {step.kind === "done" && (
          <p className={style.modalText}>
            Added {step.result.added} decision{step.result.added === 1 ? "" : "s"} to review.
            {step.result.alreadyInReview > 0 && ` ${step.result.alreadyInReview} were already in review.`}
            {step.result.ineligible > 0 && ` ${step.result.ineligible} can't be reviewed.`}
          </p>
        )}
        <div className={style.modalButtons}>
          {step.kind === "confirm" && step.plan.added > 0 ? (
            <>
              <button type="button" onClick={close} className={style.modalSecondaryButton}>
                Cancel
              </button>
              <button type="button" onClick={() => confirm(step.plan)} className={style.modalPrimaryButton}>
                Add {step.plan.added}
              </button>
            </>
          ) : step.kind === "adding" ? (
            <button type="button" disabled className={style.modalPrimaryButton}>
              Adding…
            </button>
          ) : (
            <button type="button" onClick={close} className={style.modalPrimaryButton}>
              Close
            </button>
          )}
        </div>
      </Modal>
    </>
  );
}
