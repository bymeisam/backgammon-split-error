"use client";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/app/components/ui/Button";
import Board from "@/app/components/match-analysis/Board";
import HideAnalysisCheckbox from "../HideAnalysisCheckbox";
import { style } from "../forum.styles";
import { clearForumHandoff, clearForumPostDraft, consumeForumHandoff, consumeForumPostDraft, resolveForumHandoff, storeForumPostDraft, type ForumHandoff, type ForumPostDraft } from "./handoff";

type Preview = ForumHandoff["preview"];
type Attachment = { payload: { match: { decisionId: number } } | { manual: { positionId: string; gnuMatchId: string; kind: "CHECKER" | "CUBE" } }; preview: Preview; game: boolean };

export default function NewPostForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [hideAnalysis, setHideAnalysis] = useState(false);
  const draftRead = useRef(false);
  const handoffRead = useRef(false);
  useEffect(() => {
    if (draftRead.current) return;
    draftRead.current = true;
    void Promise.resolve().then(() => {
      const draft = consumeForumPostDraft();
      if (!draft || typeof draft !== "object") return;
      const value = draft as Partial<ForumPostDraft>;
      if (typeof value.title === "string" && typeof value.body === "string") {
        setTitle(value.title);
        setBody(value.body);
      }
    });
  }, []);
  useEffect(() => {
    if (handoffRead.current) return;
    handoffRead.current = true;
    void Promise.resolve().then(() => {
      const result = resolveForumHandoff(consumeForumHandoff());
      if (result.kind === "absent") return;
      if (result.kind === "invalid") {
        setMessage("The board couldn't be attached. You can still post without one.");
        return;
      }
      const stored = result.handoff;
      setAttachment("match" in stored
        ? { payload: { match: stored.match }, preview: stored.preview, game: true }
        : { payload: { manual: stored.manual }, preview: stored.preview, game: false });
    });
  }, []);
  function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    void (async () => {
      const response = await fetch("/api/forum/posts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, body, positions: attachment ? [attachment.payload] : [], ...(attachment?.game ? { hideAnalysis } : {}) }),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => null);
        setError(result?.error ?? "Could not create post.");
        setSaving(false);
        return;
      }
      const result = await response.json();
      clearForumHandoff();
      clearForumPostDraft();
      router.push(`/forum/${result.id}`);
    })().catch(() => {
      setError("Could not create post.");
      setSaving(false);
    });
  }

  return (
    <form className={style.form} onSubmit={submit}>
      {error && <p className={style.error}>{error}</p>}
      <label>Title<input className={style.input} value={title} onChange={(event) => setTitle(event.target.value)} required /></label>
      <label>Body<textarea className={style.input} rows={8} value={body} onChange={(event) => setBody(event.target.value)} required /></label>
      <section className={style.optionalBoard} aria-labelledby="optional-board-title">
        <h2 id="optional-board-title" className={style.attachmentTitle}>Board (optional)</h2>
        {attachment ? (
          <div className={style.preview}>
            <p className={style.previewCaption} role="status">{attachment.preview.caption}</p>
            <div className={style.previewBoard}><Board decoded={attachment.preview.position} cube={attachment.preview.cube} roll={attachment.preview.dice} rollSide="mine" /></div>
            <Button type="button" variant="quiet" className={style.removeBoard} onClick={() => { setAttachment(null); setMessage(null); }}>Remove board</Button>
          </div>
        ) : (
          <>
            <p className={style.meta}>You can publish this post without a board.</p>
            <div className={style.boardSources}>
              <Button href="/matches" className={style.sourceButton} onClick={() => storeForumPostDraft({ title, body })}>Add a board from a match</Button>
              <Button href="/position-builder" className={style.sourceButton} onClick={() => storeForumPostDraft({ title, body })}>Add a board from the position builder</Button>
            </div>
            {message && <p className={style.error} role="status">{message}</p>}
          </>
        )}
      </section>
      {attachment?.game && <HideAnalysisCheckbox checked={hideAnalysis} onChange={setHideAnalysis} />}
      <div className={style.actions}><Button type="submit" variant="primary" disabled={saving}>{saving ? "Posting…" : "Post"}</Button><Button href="/forum" onClick={clearForumPostDraft}>Cancel</Button></div>
    </form>
  );
}
