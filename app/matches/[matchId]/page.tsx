"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useGameStatsAuth } from "../../GameStatsProvider";
import type { GameReviewsResponse } from "@/lib/gameReviewsTypes";
import MistakesSection from "./MistakesSection";

type Game = {
  gameIndex: number;
  data: GameReviewsResponse;
};

type StreamEvent =
  | { type: "status"; message: string }
  | { type: "game"; gameIndex: number; data: GameReviewsResponse }
  | { type: "error"; message: string }
  | { type: "done"; count: number };

export default function MatchAnalysisPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const router = useRouter();
  const { token } = useGameStatsAuth();

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [games, setGames] = useState<Game[]>([]);

  useEffect(() => {
    if (!token) {
      router.replace("/matches");
    }
  }, [token, router]);

  useEffect(() => {
    if (!token || !matchId) return;

    let cancelled = false;

    async function run() {
      setError(null);
      setGames([]);
      setStatus("Starting…");
      setLoading(true);
      try {
        const res = await fetch("/api/game_reviews", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ authorization: token, matchId }),
        });

        if (!res.ok || !res.body) {
          let message = `Request failed (${res.status}).`;
          try {
            const errJson = await res.json();
            if (errJson?.error) message = errJson.error;
          } catch {
            // ignore, keep default message
          }
          if (!cancelled) setError(message);
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let sawError = false;

        const handleEvent = (event: StreamEvent) => {
          if (cancelled) return;
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
        if (!cancelled) setError("Something went wrong while streaming the response.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [token, matchId]);

  if (!token) return null;

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 dark:bg-black">
      <main className="flex w-full max-w-7xl flex-col gap-6 px-6 py-12">
        <div className="flex w-full max-w-2xl flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
            Match {matchId}
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {loading || (!error && status) ? status : null}
          </p>
          {error && (
            <p className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
              {error}
            </p>
          )}
        </div>

        <MistakesSection games={games} />
      </main>
    </div>
  );
}
