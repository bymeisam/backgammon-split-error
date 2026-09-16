import { NextRequest } from "next/server";

const MAX_GAMES = 20;

function baseUrlFor(matchId: string) {
  return `https://api.backgammongalaxy.com/match-analytics/api/v1/game_reviews/${matchId}`;
}

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: { authorization?: string; matchId?: string };
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid request body.", 400);
  }

  const authorization = body.authorization?.trim();
  const matchId = body.matchId?.trim();

  if (!authorization) {
    return jsonError("Missing authorization.", 400);
  }
  if (!matchId || !/^\d+$/.test(matchId)) {
    return jsonError("Missing or invalid matchId.", 400);
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      };

      let count = 0;

      for (let gameIndex = 1; gameIndex <= MAX_GAMES; gameIndex++) {
        send({ type: "status", message: `Fetching game ${gameIndex}…` });

        const url = `${baseUrlFor(matchId)}/${gameIndex}`;
        const isFirst = gameIndex === 1;

        let res: Response;
        try {
          res = await fetch(url, {
            headers: { authorization },
            cache: "no-store",
          });
        } catch {
          if (isFirst) {
            send({ type: "error", message: "Network error contacting Galaxy API." });
          }
          break;
        }

        if (res.status === 404) {
          if (isFirst) {
            send({
              type: "error",
              message: "Galaxy API returned 404 for game 1. Check your match ID and authorization.",
            });
          }
          break;
        }

        if (!res.ok) {
          if (isFirst) {
            send({
              type: "error",
              message: `Galaxy API returned ${res.status} for game 1. Check your authorization and match ID.`,
            });
          }
          break;
        }

        const text = await res.text();
        if (!text) {
          if (isFirst) {
            send({ type: "error", message: "Galaxy API returned an empty response for game 1." });
          }
          break;
        }

        let data: unknown;
        try {
          data = JSON.parse(text);
        } catch {
          if (isFirst) {
            send({ type: "error", message: "Galaxy API returned a non-JSON response for game 1." });
          }
          break;
        }

        const events = (data as { data?: { events?: unknown } } | null)?.data?.events;
        if (Array.isArray(events) && events.length === 0) {
          if (isFirst) {
            send({
              type: "error",
              message: "Galaxy API returned an empty events array for game 1. Check your match ID and authorization.",
            });
          }
          break;
        }

        count += 1;
        send({ type: "game", gameIndex, data });
      }

      send({ type: "done", count });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
