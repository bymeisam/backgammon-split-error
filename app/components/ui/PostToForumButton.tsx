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
  caption = "Match position",
  variant = "secondary",
  onPost,
  disabled = false,
  className,
}: {
  decisionId?: number;
  position?: DecodedPosition;
  cube?: BoardCube | null;
  dice?: number[];
  caption?: string;
  variant?: "primary" | "secondary";
  onPost?: () => void;
  disabled?: boolean;
  className?: string;
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
      preview: { position, cube: cube ?? null, dice, caption },
    });
    if (stored) {
      router.push("/forum/new");
    } else {
      setMessage("The board couldn't be handed off. Allow session storage and try again.");
    }
  }
  return (
    <>
      <Button variant={variant} onClick={post} disabled={disabled} className={className}>Post to forum</Button>
      {message && <p className={style.message} role="status">{message}</p>}
    </>
  );
}
