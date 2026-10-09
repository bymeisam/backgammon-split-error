"use client";

import { useState } from "react";
import { parseAuthorizationFromCurl } from "@/lib/parseCurl";
import { useGameStatsAuth } from "@/app/providers/GameStatsAuthProvider";
import Modal from "@/app/components/ui/Modal";
import { style } from "./TokenModal.styles";

// The Galaxy token prompt: a pasted curl command or authorization header,
// kept by GameStatsAuthProvider in memory only (nothing is stored). Two
// callers: /sources/galaxy/matches renders it blocking while there's no
// token; the Galaxy card on /sources opens it from "Add token" and passes
// onCancel, which makes it dismissible (Esc, the backdrop, Cancel).
export default function TokenModal({ onCancel }: { onCancel?: () => void } = {}) {
  const { setToken } = useGameStatsAuth();
  const [mode, setMode] = useState<"curl" | "manual">("curl");
  const [curlText, setCurlText] = useState("");
  const [authorization, setAuthorization] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit() {
    setError(null);

    if (mode === "curl") {
      try {
        setToken(parseAuthorizationFromCurl(curlText));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't parse the curl command.");
      }
      return;
    }

    const trimmed = authorization.trim();
    if (!trimmed) {
      setError("Authorization is required.");
      return;
    }
    setToken(trimmed);
  }

  // Without onCancel it's blocking: there's nothing to do on the matches
  // page without a token, so Esc and the backdrop don't close it (Modal's
  // dismissible={false}).
  return (
    <Modal open dismissible={onCancel !== undefined} onClose={onCancel} labelledBy="token-modal-title">
      <div>
        <h2 id="token-modal-title" className={style.modalHeading}>
          Connect to Galaxy
        </h2>
        <p className={style.modalSubtext}>
          Paste a curl command or your authorization header to load your matches.
        </p>
      </div>

      <div className={style.tabRow}>
        <button
          type="button"
          onClick={() => setMode("curl")}
          className={style.tabButton(mode === "curl")}
        >
          Paste curl
        </button>
        <button
          type="button"
          onClick={() => setMode("manual")}
          className={style.tabButton(mode === "manual")}
        >
          Paste authorization
        </button>
      </div>

      {mode === "curl" ? (
        <div className={style.fieldWrapper}>
          <label htmlFor="curl" className={style.fieldLabel}>
            curl command
          </label>
          <textarea
            id="curl"
            value={curlText}
            onChange={(e) => setCurlText(e.target.value)}
            placeholder={`curl 'https://api.backgammongalaxy.com/match-analytics/api/v1/analyses/list/1' -H 'authorization: Bearer xyz...'`}
            rows={6}
            className={style.textInput}
          />
        </div>
      ) : (
        <div className={style.fieldWrapper}>
          <label htmlFor="auth" className={style.fieldLabel}>
            Authorization header
          </label>
          <input
            id="auth"
            type="text"
            value={authorization}
            onChange={(e) => setAuthorization(e.target.value)}
            placeholder="Bearer xyz..."
            className={style.textInput}
          />
        </div>
      )}

      {error && (
        <p className={style.errorBox}>
          {error}
        </p>
      )}

      <div className={style.buttons}>
        <button
          type="button"
          onClick={handleSubmit}
          className={style.connectButton}
        >
          Connect
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className={style.cancelButton}>
            Cancel
          </button>
        )}
      </div>
    </Modal>
  );
}
