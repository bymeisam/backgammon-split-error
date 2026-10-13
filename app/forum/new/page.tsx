"use client";
import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PageShell from "@/app/components/ui/PageShell";
import Button from "@/app/components/ui/Button";
import { style } from "../forum.styles";

type AttachmentSource = "manual" | "match";

type PositionAttachment = {
  source: AttachmentSource;
  positionId: string;
  gnuMatchId: string;
  kind: "CHECKER" | "CUBE";
  decisionId: string;
};

export default function NewForumPostPage() {
  const params = useSearchParams();
  const router = useRouter();
  const decision = params.get("decision");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState<PositionAttachment[]>([
    decision
      ? { source: "match", positionId: "", gnuMatchId: "", kind: "CHECKER", decisionId: decision }
      : {
          source: "manual",
          positionId: params.get("positionId") ?? "",
          gnuMatchId: params.get("gnuMatchId") ?? "",
          kind: params.get("kind") === "CUBE" ? "CUBE" : "CHECKER",
          decisionId: "",
        },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function updateAttachment(index: number, patch: Partial<PositionAttachment>) {
    setAttachments((current) =>
      current.map((attachment, attachmentIndex) =>
        attachmentIndex === index ? { ...attachment, ...patch } : attachment,
      ),
    );
  }

  function addAttachment() {
    setAttachments((current) => [
      ...current,
      { source: "manual", positionId: "", gnuMatchId: "", kind: "CHECKER", decisionId: "" },
    ]);
  }

  function removeAttachment(index: number) {
    setAttachments((current) => current.filter((_, attachmentIndex) => attachmentIndex !== index));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const positions = attachments.map((attachment) =>
      attachment.source === "match"
        ? { match: { decisionId: Number(attachment.decisionId) } }
        : {
            manual: {
              positionId: attachment.positionId,
              gnuMatchId: attachment.gnuMatchId,
              kind: attachment.kind,
            },
          },
    );
    const response = await fetch("/api/forum/posts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title, body, positions }),
    });
    if (!response.ok) {
      const result = await response.json().catch(() => null);
      setError(result?.error ?? "Could not create post.");
      setSaving(false);
      return;
    }
    const result = await response.json();
    router.push(`/forum/${result.id}`);
  }

  return (
    <PageShell
      width="medium"
      title="New forum post"
      breadcrumbs={[{ label: "Forum", href: "/forum" }, { label: "New post" }]}
    >
      <form className={style.form} onSubmit={submit}>
        {error && <p className={style.error}>{error}</p>}
        <label>
          Title
          <input className={style.input} value={title} onChange={(event) => setTitle(event.target.value)} required />
        </label>
        <label>
          Body
          <textarea
            className={style.input}
            rows={8}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            required
          />
        </label>
        <div className={style.attachmentList}>
          {attachments.map((attachment, index) => (
            <section className={style.attachment} key={index}>
              <div className={style.attachmentHeader}>
                <h2 className={style.attachmentTitle}>Position {index + 1}</h2>
                {attachments.length > 1 && (
                  <Button type="button" size="small" onClick={() => removeAttachment(index)}>
                    Remove
                  </Button>
                )}
              </div>
              <label>
                Source
                <select
                  className={style.input}
                  value={attachment.source}
                  onChange={(event) => updateAttachment(index, { source: event.target.value as AttachmentSource })}
                >
                  <option value="manual">Position builder / GNU IDs</option>
                  <option value="match">Match decision</option>
                </select>
              </label>
              {attachment.source === "match" ? (
                <label>
                  Decision ID
                  <input
                    className={style.input}
                    type="number"
                    min="1"
                    value={attachment.decisionId}
                    onChange={(event) => updateAttachment(index, { decisionId: event.target.value })}
                    required
                  />
                </label>
              ) : (
                <>
                  <label>
                    GNU Position ID
                    <input
                      className={style.input}
                      value={attachment.positionId}
                      onChange={(event) => updateAttachment(index, { positionId: event.target.value })}
                      required
                    />
                  </label>
                  <label>
                    GNU Match ID
                    <input
                      className={style.input}
                      value={attachment.gnuMatchId}
                      onChange={(event) => updateAttachment(index, { gnuMatchId: event.target.value })}
                      required
                    />
                  </label>
                  <label>
                    Kind
                    <select
                      className={style.input}
                      value={attachment.kind}
                      onChange={(event) =>
                        updateAttachment(index, { kind: event.target.value as PositionAttachment["kind"] })
                      }
                    >
                      <option value="CHECKER">Checker</option>
                      <option value="CUBE">Cube</option>
                    </select>
                  </label>
                </>
              )}
            </section>
          ))}
        </div>
        <div className={style.actions}>
          <Button type="button" onClick={addAttachment}>
            Add position
          </Button>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? "Posting…" : "Post"}
          </Button>
          <Button href="/forum">Cancel</Button>
        </div>
      </form>
    </PageShell>
  );
}
