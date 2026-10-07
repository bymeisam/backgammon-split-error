// Input validation for the review and tag API routes (app/api/review/*,
// app/api/tags/*). Pure, so it's unit-tested.
import { isRating, type ReviewRating } from "@/lib/review/fsrs";

// A positive integer id, from JSON (a number) or a URL segment (digits).
export function positiveId(v: unknown): number | null {
  if (typeof v === "number") return Number.isSafeInteger(v) && v > 0 ? v : null;
  if (typeof v === "string" && /^[1-9]\d*$/.test(v)) {
    const n = Number(v);
    return Number.isSafeInteger(n) ? n : null;
  }
  return null;
}

export function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// Reads a JSON object body, or null when it isn't one.
export async function readJsonObject(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await req.json();
    return isObject(body) ? body : null;
  } catch {
    return null;
  }
}

const MAX_DURATION_MS = 24 * 60 * 60 * 1000;

export type AnswerInput =
  | { ok: true; chosen: string; rating: ReviewRating | null; durationMs: number | null }
  | { ok: false; error: string };

// POST /api/review/cards/[id]/answer's body: { chosen, rating?, durationMs? }.
// The rating is checked against the grade in the route: a wrong answer is
// always Again; a right one needs hard / good / easy.
export function parseAnswerInput(body: Record<string, unknown>): AnswerInput {
  const { chosen, rating, durationMs } = body;
  if (typeof chosen !== "string" || chosen.length === 0 || chosen.length > 191) {
    return { ok: false, error: "chosen must be a non-empty string (an option key)." };
  }
  if (rating !== undefined && rating !== null && !isRating(rating)) {
    return { ok: false, error: "rating must be one of again, hard, good, easy." };
  }
  let duration: number | null = null;
  if (durationMs !== undefined && durationMs !== null) {
    if (typeof durationMs !== "number" || !Number.isInteger(durationMs) || durationMs < 0 || durationMs > MAX_DURATION_MS) {
      return { ok: false, error: "durationMs must be a whole number of milliseconds, 0 to 24 h." };
    }
    duration = durationMs;
  }
  return { ok: true, chosen, rating: (rating as ReviewRating | null | undefined) ?? null, durationMs: duration };
}

// The rating an answer is saved with, or an error: wrong -> again (a client
// rating other than again is rejected), right -> the client's hard / good /
// easy (again isn't offered for a right answer).
export function ratingFor(correct: boolean, rating: ReviewRating | null): { ok: true; rating: ReviewRating } | { ok: false; error: string } {
  if (!correct) {
    if (rating !== null && rating !== "again") return { ok: false, error: "A wrong answer is always rated Again." };
    return { ok: true, rating: "again" };
  }
  if (rating === "hard" || rating === "good" || rating === "easy") return { ok: true, rating };
  return { ok: false, error: "A right answer needs a rating: hard, good or easy." };
}
