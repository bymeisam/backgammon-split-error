"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Button from "@/app/components/ui/Button";
import { style } from "../forum.styles";
import ProposalDraft from "./ProposalDraft";
import type { ProposalDraftValue, ProposalPositionOption } from "./proposalTypes";

// canWrite: isAppWriteEnabled(), decided by the server page (the forum API routes' gate). Off hides the composer.
export default function ReplyComposer({ postId, canWrite, positions }: { postId: number; canWrite: boolean; positions: ProposalPositionOption[] }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<number, ProposalDraftValue>>({});

  if (!canWrite) return null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!body.trim() && Object.keys(drafts).length === 0) {
      setError("Reply text or a proposal is required.");
      return;
    }

    const response = await fetch(`/api/forum/posts/${postId}/replies`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body, proposals: Object.values(drafts).map((draft) => draft.kind === "CHECKER"
        ? { studyPositionId: draft.positionId, resultPositionId: draft.resultPositionId }
        : { studyPositionId: draft.positionId, cubeAction: draft.cubeAction }) }),
    });
    if (!response.ok) {
      const result = await response.json().catch(() => null);
      setError(result?.error ?? "Could not reply.");
      return;
    }

    // A successful submission clears the reply body and all proposal drafts.
    setBody("");
    setDrafts({});
    router.refresh();
  }

  return (
    <form className={style.form} onSubmit={submit}>
      <textarea
        className={style.input}
        rows={4}
        placeholder="Write a reply"
        aria-label="Reply"
        value={body}
        onChange={(event) => setBody(event.target.value)}
      />
      {positions.map((position) => (
        <ProposalDraft
          key={position.id}
          position={position}
          value={drafts[position.id] ?? null}
          onChange={(proposal) => setDrafts((current) => {
            if (proposal === null) {
              const next = { ...current };
              delete next[position.id];
              return next;
            }
            return { ...current, [position.id]: proposal };
          })}
        />
      ))}
      <div className={style.formActions}>
        <Button type="submit" variant="primary">
          Reply
        </Button>
      </div>
      {error && <p className={style.error}>{error}</p>}
    </form>
  );
}
