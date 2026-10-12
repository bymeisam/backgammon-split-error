"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/app/components/ui/Button";
import { style } from "../forum.styles";

export default function ReplyComposer({ postId }: { postId: number }) {
  const router = useRouter(); const [body, setBody] = useState(""); const [error, setError] = useState<string | null>(null);
  return <form className={style.form} onSubmit={async (event) => { event.preventDefault(); setError(null); const response = await fetch(`/api/forum/posts/${postId}/replies`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ body }) }); if (!response.ok) { const result = await response.json().catch(() => null); setError(result?.error ?? "Could not reply."); return; } setBody(""); router.refresh(); }}><textarea className={style.input} rows={4} placeholder="Write a reply" value={body} onChange={(event) => setBody(event.target.value)} required /><Button type="submit" variant="primary">Reply</Button>{error && <p className={style.error}>{error}</p>}</form>;
}
