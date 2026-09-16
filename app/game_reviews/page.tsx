"use client";

import { useState } from "react";
import { parseCurl } from "@/lib/parseCurl";

type Game = {
  gameIndex: number;
  data: unknown;
};

type StreamEvent =
  | { type: "status"; message: string }
  | { type: "game"; gameIndex: number; data: unknown }
  | { type: "error"; message: string }
  | { type: "done"; count: number };

export default function GameReviewsPage() {
  const [mode, setMode] = useState<"curl" | "manual">("curl");
  const [curlText, setCurlText] = useState("");
  const [authorization, setAuthorization] = useState("");
  const [matchId, setMatchId] = useState("");

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [games, setGames] = useState<Game[]>([]);

  async function handleFetch() {
    setError(null);
    setGames([]);
    setStatus("");

    let auth: string;
    let id: string;

    if (mode === "curl") {
      try {
        const parsed = parseCurl(curlText);
        auth = parsed.authorization;
        id = parsed.matchId;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't parse the curl command.");
        return;
      }
    } else {
      auth = authorization.trim();
      id = matchId.trim();
      if (!auth) {
        setError("Authorization is required.");
        return;
      }
      if (!id || !/^\d+$/.test(id)) {
        setError("Match ID must be numeric.");
        return;
      }
    }

    setLoading(true);
    setStatus("Starting…");

    try {
      const res = await fetch("/api/game_reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authorization: auth, matchId: id }),
      });

      if (!res.ok || !res.body) {
        let message = `Request failed (${res.status}).`;
        try {
          const errJson = await res.json();
          if (errJson?.error) message = errJson.error;
        } catch {
          // ignore, keep default message
        }
        setError(message);
        setLoading(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let sawError = false;

      const handleEvent = (event: StreamEvent) => {
        if (event.type === "status") {
          setStatus(event.message);
        } else if (event.type === "game") {
          setGames((prev) => [...prev, { gameIndex: event.gameIndex, data: event.data }]);
        } else if (event.type === "error") {
          sawError = true;
          setError(event.message);
        } else if (event.type === "done") {
          if (!sawError) {
            setStatus(`Done — ${event.count} game${event.count === 1 ? "" : "s"} found`);
          }
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as StreamEvent;
          handleEvent(event);
        }
      }

      if (buffer.trim()) {
        const event = JSON.parse(buffer) as StreamEvent;
        handleEvent(event);
      }
    } catch {
      setError("Something went wrong while streaming the response.");
    } finally {
      setLoading(false);
    }
  }

  const prettyJson = games.length > 0 ? JSON.stringify(games, null, 2) : "";

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 dark:bg-black">
      <main className="flex w-full max-w-3xl flex-col gap-6 px-6 py-12">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
            Game review dumper
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Fetches every game in a match from Galaxy&apos;s{" "}
            <code className="font-mono">game_reviews</code> API and dumps the raw JSON below.
          </p>
        </div>

        <div className="inline-flex w-fit rounded-full border border-black/10 bg-white p-1 dark:border-white/15 dark:bg-zinc-900">
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
            Paste authorization + match ID
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
              placeholder={`curl 'https://api.backgammongalaxy.com/match-analytics/api/v1/game_reviews/46431891/1' -H 'authorization: Bearer xyz...'`}
              rows={6}
              className="w-full rounded-lg border border-black/10 bg-white p-3 font-mono text-xs text-black outline-none focus:border-black/30 dark:border-white/15 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-white/30"
            />
          </div>
        ) : (
          <div className="flex flex-col gap-3">
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
            <div className="flex flex-col gap-2">
              <label htmlFor="matchId" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Match ID
              </label>
              <input
                id="matchId"
                type="text"
                inputMode="numeric"
                value={matchId}
                onChange={(e) => setMatchId(e.target.value)}
                placeholder="46431891"
                className="w-full rounded-lg border border-black/10 bg-white p-3 font-mono text-xs text-black outline-none focus:border-black/30 dark:border-white/15 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-white/30"
              />
            </div>
          </div>
        )}

        <div>
          <button
            type="button"
            onClick={handleFetch}
            disabled={loading}
            className="inline-flex h-10 items-center justify-center rounded-full bg-foreground px-6 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-50 dark:hover:bg-[#ccc]"
          >
            {loading ? "Fetching…" : "Fetch"}
          </button>
        </div>

        {status && !error && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{status}</p>
        )}
        {error && (
          <p className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        )}

        <pre className="max-h-[60vh] overflow-auto whitespace-pre rounded-lg border border-black/10 bg-white p-4 font-mono text-xs text-black dark:border-white/15 dark:bg-zinc-900 dark:text-zinc-100">
          {prettyJson || "No data yet."}
        </pre>
      </main>
    </div>
  );
}
