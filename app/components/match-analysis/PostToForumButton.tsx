"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/app/components/ui/Button";
import type { BoardCube } from "@/lib/boardFrame";
import type { DecodedPosition } from "@/lib/gnuPositionId";
import { storeForumHandoff } from "@/app/forum/new/handoff";
import { style } from "./PostToForumButton.styles";
export default function PostToForumButton({
  decisionId,
  position,
  cube,
  dice,
  onPost,
  disabled = false,
}: {
  decisionId?: number;
  position?: DecodedPosition;
  cube?: BoardCube | null;
  dice?: number[];
  onPost?: () => void;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  function post() {
    if (onPost) {
      onPost();
      return;
    }
    if (decisionId === undefined || !position || !dice) return;
    const stored = storeForumHandoff({
      match: { decisionId },
      preview: { position, cube: cube ?? null, dice, caption: "Match position" },
    });
    if (stored) {
      router.push("/forum/new");
    } else {
      setMessage("The board couldn't be handed off. Allow session storage and try again.");
    }
  }
  return (
    <>
      <Button variant="secondary" onClick={post} disabled={disabled}>Post to forum</Button>
      {message && <p className={style.message} role="status">{message}</p>}
    </>
  );
}
