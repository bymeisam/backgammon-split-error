import { NextRequest } from "next/server";
import type { AnalysesListResponse } from "@/lib/analysesTypes";
import { analysesListUrl } from "@/lib/galaxyEndpoints";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: { authorization?: string; page?: number };
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid request body.", 400);
  }

  const authorization = body.authorization?.trim();
  const page = body.page;

  if (!authorization) {
    return jsonError("Missing authorization.", 400);
  }
  if (!page || !Number.isInteger(page) || page < 1) {
    return jsonError("Missing or invalid page.", 400);
  }

  let res: Response;
  try {
    res = await fetch(analysesListUrl(page), {
      headers: { authorization },
      cache: "no-store",
    });
  } catch {
    return jsonError("Network error contacting Galaxy API.", 502);
  }

  if (!res.ok) {
    return jsonError(
      `Galaxy API returned ${res.status} for page ${page}. Check your authorization.`,
      502
    );
  }

  const text = await res.text();
  if (!text) {
    return jsonError("Galaxy API returned an empty response.", 502);
  }

  let data: AnalysesListResponse;
  try {
    data = JSON.parse(text) as AnalysesListResponse;
  } catch {
    return jsonError("Galaxy API returned a non-JSON response.", 502);
  }

  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
