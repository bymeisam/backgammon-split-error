// Pure helpers for decision notes (DecisionNote in prisma/schema.prisma),
// shared by the save route (app/api/decisions/[id]/note), the live-path
// read route (app/api/decision-notes), the client UI and the notes sync
// scripts. No Prisma import here, so client components can use it too.
import type { Decision } from "@/lib/mistakes";

// A sensible cap for a personal free-text note. Checked against the trimmed
// note on the server; the textarea's maxLength mirrors it on the client.
export const NOTE_MAX_LENGTH = 10_000;

// Decision.id as it arrives in a URL segment: a positive integer, written
// as plain digits (no sign, exponent, decimal point or leading zeros).
export function parseDecisionId(param: string): number | null {
  if (!/^[1-9]\d*$/.test(param)) return null;
  const id = Number(param);
  return Number.isSafeInteger(id) ? id : null;
}

export type NormalizedNote =
  | { ok: true; note: string | null }
  | { ok: false; error: string };

// The incoming note from a save request. Trimmed; an empty or
// whitespace-only note normalizes to null, which means "delete the note".
export function normalizeNote(input: unknown): NormalizedNote {
  if (typeof input !== "string") return { ok: false, error: "note must be a string." };
  const note = input.trim();
  if (note.length === 0) return { ok: true, note: null };
  if (note.length > NOTE_MAX_LENGTH) {
    return { ok: false, error: `note is too long (max ${NOTE_MAX_LENGTH.toLocaleString("en-US")} characters).` };
  }
  return { ok: true, note };
}

// One DB decision of a match, as GET /api/decision-notes returns it for the
// live path (MistakesSection). eventId is a string: it's a BigInt column and
// JSON has no BigInt.
export interface MatchDecisionNoteEntry {
  gameIndex: number;
  eventId: string;
  dbDecisionId: number;
  note: string | null;
}

export interface MatchDecisionNotesResponse {
  // isGalaxyEnabled() on the server, i.e. whether the save route is
  // reachable at all.
  canEdit: boolean;
  // Every Decision row the DB has for the match (empty when the match isn't
  // ingested).
  decisions: MatchDecisionNoteEntry[];
}

// Live-path key for a decision: lib/mistakes.ts's extractDecisions builds
// Decision.id as exactly `${gameIndex}:${eventId}`, so a DB entry keyed the
// same way lines up with it — (gameIndex, eventId) is the decision's natural
// key within one match (Game @@unique([matchId, gameIndex]), Decision
// @@unique([gameId, eventId])).
export function liveDecisionKey(gameIndex: number, eventId: string): string {
  return `${gameIndex}:${eventId}`;
}

// Attaches note/dbDecisionId to live-path decisions that exist in the DB.
// Decisions with no DB counterpart (match not ingested, or a decision the DB
// doesn't have) keep note/dbDecisionId null, so no note UI renders for them.
export function attachNotes(decisions: Decision[], entries: MatchDecisionNoteEntry[]): Decision[] {
  const byKey = new Map(entries.map((e) => [liveDecisionKey(e.gameIndex, e.eventId), e]));
  return decisions.map((d) => {
    const entry = byKey.get(d.id);
    return { ...d, note: entry?.note ?? null, dbDecisionId: entry?.dbDecisionId ?? null };
  });
}

// Natural key + content of one note, as scripts/notes-export.ts writes it
// and scripts/notes-import.ts reads it. Decision ids differ between local
// and Oracle, so a note travels by (source, sourceMatchId, gameIndex,
// eventId) instead. eventId and the timestamps are strings (JSON).
export interface ExportedNote {
  source: string;
  sourceMatchId: string;
  gameIndex: number;
  eventId: string;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export type ImportOutcome = "new" | "updated" | "skipped";

// What notes-import does with one entry whose decision exists in the target
// DB: create when there's no note yet, overwrite only when the incoming note
// is strictly newer, otherwise leave the existing (same or newer) note alone.
export function importOutcome(existingUpdatedAt: Date | null, incomingUpdatedAt: Date): ImportOutcome {
  if (existingUpdatedAt === null) return "new";
  return incomingUpdatedAt.getTime() > existingUpdatedAt.getTime() ? "updated" : "skipped";
}
