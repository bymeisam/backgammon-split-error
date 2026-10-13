"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Button from "@/app/components/ui/Button";
import { style } from "../forum.styles";

// canWrite: isGalaxyEnabled(), decided by the server page (the forum API routes' gate). Off hides the composer.
export default function ReplyComposer({ postId, canWrite }: { postId: number; canWrite: boolean }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!canWrite) return null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const response = await fetch(`/api/forum/posts/${postId}/replies`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body }),
    });
    if (!response.ok) {
      const result = await response.json().catch(() => null);
      setError(result?.error ?? "Could not reply.");
      return;
    }

    // Posted: clear the box and re-render the server page with the new reply.
    setBody("");
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
        required
      />
      <div className={style.formActions}>
        <Button type="submit" variant="primary">
          Reply
        </Button>
      </div>
      {error && <p className={style.error}>{error}</p>}
    </form>
  );
}
