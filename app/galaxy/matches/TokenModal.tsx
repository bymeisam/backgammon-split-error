"use client";

import { useState } from "react";
import { parseAuthorizationFromCurl } from "@/lib/parseCurl";
import { useGameStatsAuth } from "@/app/providers/GameStatsAuthProvider";
import { style } from "./galaxyMatches.styles";

export default function TokenModal() {
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

  return (
    <div className={style.modalOverlay}>
      <div className={style.modalPanel}>
        <div>
          <h2 className={style.modalHeading}>Connect to Galaxy</h2>
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

        <div>
          <button
            type="button"
            onClick={handleSubmit}
            className={style.connectButton}
          >
            Connect
          </button>
        </div>
      </div>
    </div>
  );
}
