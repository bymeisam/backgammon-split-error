"use client";

import { useState } from "react";
import { parseAuthorizationFromCurl } from "@/lib/parseCurl";
import { useGameStatsAuth } from "../GameStatsProvider";

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-6">
      <div className="flex w-full max-w-lg flex-col gap-4 rounded-xl border border-black/10 bg-white p-6 shadow-xl dark:border-white/15 dark:bg-zinc-900">
        <div>
          <h2 className="text-lg font-semibold text-black dark:text-zinc-50">Connect to Galaxy</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Paste a curl command or your authorization header to load your matches.
          </p>
        </div>

        <div className="inline-flex w-fit rounded-full border border-black/10 bg-zinc-50 p-1 dark:border-white/15 dark:bg-zinc-800">
          <button
            type="button"
            onClick={() => setMode("curl")}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              mode === "curl"
                ? "bg-foreground text-background"
                : "text-zinc-600 dark:text-zinc-400"
            }`}
          >
            Paste curl
          </button>
          <button
            type="button"
            onClick={() => setMode("manual")}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              mode === "manual"
                ? "bg-foreground text-background"
                : "text-zinc-600 dark:text-zinc-400"
            }`}
          >
            Paste authorization
          </button>
        </div>

        {mode === "curl" ? (
          <div className="flex flex-col gap-2">
            <label htmlFor="curl" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              curl command
            </label>
            <textarea
              id="curl"
              value={curlText}
              onChange={(e) => setCurlText(e.target.value)}
              placeholder={`curl 'https://api.backgammongalaxy.com/match-analytics/api/v1/analyses/list/1' -H 'authorization: Bearer xyz...'`}
              rows={6}
              className="w-full rounded-lg border border-black/10 bg-white p-3 font-mono text-xs text-black outline-none focus:border-black/30 dark:border-white/15 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-white/30"
            />
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <label htmlFor="auth" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Authorization header
            </label>
            <input
              id="auth"
              type="text"
              value={authorization}
              onChange={(e) => setAuthorization(e.target.value)}
              placeholder="Bearer xyz..."
              className="w-full rounded-lg border border-black/10 bg-white p-3 font-mono text-xs text-black outline-none focus:border-black/30 dark:border-white/15 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-white/30"
            />
          </div>
        )}

        {error && (
          <p className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        )}

        <div>
          <button
            type="button"
            onClick={handleSubmit}
            className="inline-flex h-10 items-center justify-center rounded-full bg-foreground px-6 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
          >
            Connect
          </button>
        </div>
      </div>
    </div>
  );
}
