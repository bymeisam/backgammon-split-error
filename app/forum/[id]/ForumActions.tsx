"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Button from "@/app/components/ui/Button";
import Modal from "@/app/components/ui/Modal";
import { style } from "../forum.styles";

type ForumActionsProps = {
  postId: number;
  // Set for the post's own actions (edits title and body).
  title?: string;
  body?: string;
  // Set for a reply's actions (edits the body only).
  replyId?: number;
  replyBody?: string;
  // The post's reply count, for its delete confirmation (post actions only).
  replyCount?: number;
  // Decided by the server page: write mode (isGalaxyEnabled(), the forum API
  // routes' gate) and lib/forumPermissions.ts. Edit is the author's only;
  // Delete is the author's, or the owner's on anyone's (moderation).
  canEdit: boolean;
  canDelete: boolean;
};

// Edit and Delete for a post or one of its replies.
export default function ForumActions({
  postId,
  title,
  body,
  replyId,
  replyBody,
  replyCount = 0,
  canEdit,
  canDelete,
}: ForumActionsProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [nextTitle, setNextTitle] = useState(title ?? "");
  const [nextBody, setNextBody] = useState(body ?? replyBody ?? "");
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const url = replyId ? `/api/forum/replies/${replyId}` : `/api/forum/posts/${postId}`;

  // Sends the request; on success re-renders the server page, on failure
  // shows the route's error message.
  async function send(method: string, payload?: object): Promise<boolean> {
    const response = await fetch(url, {
      method,
      headers: payload ? { "content-type": "application/json" } : undefined,
      body: payload ? JSON.stringify(payload) : undefined,
    });
    if (!response.ok) {
      const result = await response.json().catch(() => null);
      setError(result?.error ?? "Request failed.");
      return false;
    }
    router.refresh();
    return true;
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    const ok = await send("PATCH", replyId ? { body: nextBody } : { title: nextTitle, body: nextBody });
    if (ok) setEditing(false);
  }

  async function remove() {
    setBusy(true);
    const ok = await send("DELETE");
    setBusy(false);
    if (ok) setConfirming(false);
  }

  // Unique per instance: the post page renders one ForumActions per reply.
  const dialogId = replyId !== undefined ? `delete-reply-${replyId}` : `delete-post-${postId}`;

  if (!canEdit && !canDelete) return null;

  if (editing) {
    return (
      <form className={style.form} onSubmit={save}>
        {replyId === undefined && (
          <input
            className={style.input}
            aria-label="Title"
            value={nextTitle}
            onChange={(event) => setNextTitle(event.target.value)}
          />
        )}
        <textarea
          className={style.input}
          aria-label="Body"
          rows={6}
          value={nextBody}
          onChange={(event) => setNextBody(event.target.value)}
        />
        <div className={style.actions}>
          <Button type="submit" variant="primary">
            Save
          </Button>
          <Button onClick={() => setEditing(false)}>Cancel</Button>
        </div>
        {error && <p className={style.error}>{error}</p>}
      </form>
    );
  }

  return (
    <div className={style.actions}>
      {canEdit && (title !== undefined || replyId !== undefined) && (
        <Button size="small" onClick={() => setEditing(true)}>
          Edit
        </Button>
      )}
      {canDelete && (
        <Button size="small" variant="quiet" onClick={() => setConfirming(true)}>
          Delete
        </Button>
      )}
      {error && !confirming && <p className={style.error}>{error}</p>}

      <Modal
        open={confirming}
        dismissible={!busy}
        onClose={() => setConfirming(false)}
        labelledBy={dialogId}
        testId="delete-forum-dialog"
      >
        <h2 id={dialogId} className={style.modalHeading}>
          {replyId !== undefined ? "Delete this reply?" : "Delete this post?"}
        </h2>
        {replyId !== undefined ? (
          <p className={style.modalText}>This can&apos;t be undone.</p>
        ) : (
          replyCount > 0 && (
            <p className={style.modalText}>
              {replyCount === 1 ? "Its reply goes with it." : `Its ${replyCount} replies go with it.`}
            </p>
          )
        )}
        {error && <p className={style.error}>{error}</p>}
        <div className={style.modalButtons}>
          <Button onClick={() => setConfirming(false)} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" onClick={remove} disabled={busy}>
            {busy ? "Deleting…" : "Delete"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
