"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/app/components/ui/Button";
import { style } from "../forum.styles";

// canWrite: isGalaxyEnabled(), decided by the server page (the forum API routes' gate). Off hides Edit and Delete.
export default function ForumActions({ postId, title, body, replyId, replyBody, canWrite }: { postId: number; title?: string; body?: string; replyId?: number; replyBody?: string; canWrite: boolean }) {
  const router = useRouter(); const [editing, setEditing] = useState(false); const [nextTitle, setNextTitle] = useState(title ?? ""); const [nextBody, setNextBody] = useState(body ?? replyBody ?? ""); const [error, setError] = useState<string | null>(null);
  async function send(method: string, url: string, payload?: object) { const response = await fetch(url, { method, headers: payload ? { "content-type": "application/json" } : undefined, body: payload ? JSON.stringify(payload) : undefined }); if (!response.ok) { const result = await response.json().catch(() => null); setError(result?.error ?? "Request failed."); return false; } router.refresh(); return true; }
  if (!canWrite) return null;
  if (editing) return <form className={style.form} onSubmit={async (event) => { event.preventDefault(); const ok = await send("PATCH", replyId ? `/api/forum/replies/${replyId}` : `/api/forum/posts/${postId}`, replyId ? { body: nextBody } : { title: nextTitle, body: nextBody }); if (ok) setEditing(false); }}>{replyId === undefined && <input className={style.input} value={nextTitle} onChange={(event) => setNextTitle(event.target.value)} />}<textarea className={style.input} value={nextBody} onChange={(event) => setNextBody(event.target.value)} /><div className={style.actions}><Button type="submit" variant="primary">Save</Button><Button onClick={() => setEditing(false)}>Cancel</Button></div>{error && <p className={style.error}>{error}</p>}</form>;
  return <div className={style.actions}>{(title !== undefined || replyId !== undefined) && <Button size="small" onClick={() => setEditing(true)}>Edit</Button>}<Button size="small" onClick={async () => { if (window.confirm("Delete this item?")) await send("DELETE", replyId ? `/api/forum/replies/${replyId}` : `/api/forum/posts/${postId}`); }}>Delete</Button>{error && <p className={style.error}>{error}</p>}</div>;
}
