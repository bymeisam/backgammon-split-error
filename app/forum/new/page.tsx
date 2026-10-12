"use client";
import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PageShell from "@/app/components/ui/PageShell";
import Button from "@/app/components/ui/Button";
import { style } from "../forum.styles";

export default function NewForumPostPage() {
  const params = useSearchParams(); const router = useRouter();
  const [title, setTitle] = useState(""); const [body, setBody] = useState("");
  const [positionId, setPositionId] = useState(params.get("positionId") ?? ""); const [gnuMatchId, setGnuMatchId] = useState(params.get("gnuMatchId") ?? "");
  const [kind, setKind] = useState(params.get("kind") === "CUBE" ? "CUBE" : "CHECKER"); const decision = params.get("decision"); const [error, setError] = useState<string | null>(null); const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent) { event.preventDefault(); setSaving(true); setError(null); const source = decision ? { match: { decisionId: Number(decision) } } : { manual: { positionId, gnuMatchId, kind } }; const response = await fetch("/api/forum/posts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title, body, ...source }) }); if (!response.ok) { const result = await response.json().catch(() => null); setError(result?.error ?? "Could not create post."); setSaving(false); return; } const result = await response.json(); router.push(`/forum/${result.id}`); }
  return <PageShell width="medium" title="New forum post" breadcrumbs={[{ label: "Forum", href: "/forum" }, { label: "New post" }]}><form className={style.form} onSubmit={submit}>{error && <p className={style.error}>{error}</p>}<label>Title<input className={style.input} value={title} onChange={(e) => setTitle(e.target.value)} required /></label><label>Body<textarea className={style.input} rows={8} value={body} onChange={(e) => setBody(e.target.value)} required /></label>{decision ? <p className={style.meta}>Attached to decision {decision}.</p> : <><label>GNU Position ID<input className={style.input} value={positionId} onChange={(e) => setPositionId(e.target.value)} required /></label><label>GNU Match ID<input className={style.input} value={gnuMatchId} onChange={(e) => setGnuMatchId(e.target.value)} required /></label><label>Kind<select className={style.input} value={kind} onChange={(e) => setKind(e.target.value)}><option value="CHECKER">Checker</option><option value="CUBE">Cube</option></select></label></>}<div className={style.actions}><Button type="submit" variant="primary" disabled={saving}>{saving ? "Posting…" : "Post"}</Button><Button href="/forum">Cancel</Button></div></form></PageShell>;
}
