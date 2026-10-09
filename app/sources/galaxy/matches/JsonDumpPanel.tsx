"use client";

import { useEffect, useRef, useState } from "react";
import { galaxyPost, jsonOrThrow } from "@/lib/galaxyPost";
import { style } from "./galaxyMatches.styles";

// Debug tool on /sources/galaxy/matches: raw game_reviews JSON for a matchId /
// gameIndex, through the same route the detail page's game loop calls — no
// new fetch path. Not a replacement for the PR/mistakes/board view, just a
// quick way to inspect an event's real shape without leaving the browser.
//
// Split into a hook and a panel because the trigger isn't part of the
// panel: "Show JSON" sits in the page's header form, sharing its Match ID
// input with "Jump to match".

type JsonDump =
  | { status: "loading" }
  | { status: "data"; text: string }
  | { status: "error"; message: string };

const COPIED_RESET_MS = 2000;

export function useJsonDump(token: string | null) {
  const [dump, setDump] = useState<JsonDump | null>(null);
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The "Copied!" reset must not outlive the page.
  useEffect(
    () => () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
    },
    []
  );

  async function show(matchId: string, gameIndex: string) {
    const trimmedMatchId = matchId.trim();
    const trimmedGameIndex = gameIndex.trim();
    if (!trimmedMatchId || !trimmedGameIndex || !token) return;

    setDump({ status: "loading" });
    setCopied(false);

    try {
      const json = await jsonOrThrow(
        await galaxyPost(`/api/galaxy/matches/${trimmedMatchId}/${trimmedGameIndex}`, token)
      );
      setDump({ status: "data", text: JSON.stringify(json, null, 2) });
    } catch (e) {
      setDump({ status: "error", message: e instanceof Error ? e.message : "Something went wrong." });
    }
  }

  async function copy() {
    if (dump?.status !== "data") return;
    await navigator.clipboard.writeText(dump.text);
    setCopied(true);
    // A second copy restarts the 2s window rather than being cut short by
    // the first copy's reset.
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(false), COPIED_RESET_MS);
  }

  return { dump, copied, show, copy, close: () => setDump(null) };
}

export default function JsonDumpPanel({
  dump,
  copied,
  onCopy,
  onClose,
  matchId,
  gameIndex,
}: {
  dump: JsonDump;
  copied: boolean;
  onCopy: () => void;
  onClose: () => void;
  // The header inputs' current values, echoed in the panel's title.
  matchId: string;
  gameIndex: string;
}) {
  return (
    <div className={style.jsonBox}>
      <div className={style.jsonBoxHeader}>
        <span className={style.jsonBoxLabel}>
          Raw JSON — match {matchId || "?"} game {gameIndex || "?"}
        </span>
        <div className={style.jsonBoxActions}>
          {dump.status === "data" && (
            <button type="button" onClick={onCopy} className={style.jsonLinkButton}>
              {copied ? "Copied!" : "Copy"}
            </button>
          )}
          <button type="button" onClick={onClose} className={style.jsonLinkButton}>
            Close
          </button>
        </div>
      </div>
      {dump.status === "loading" && <p className={style.mutedText}>Loading…</p>}
      {dump.status === "error" && <p className={style.errorBox}>{dump.message}</p>}
      {dump.status === "data" && <pre className={style.jsonPre}>{dump.text}</pre>}
    </div>
  );
}
