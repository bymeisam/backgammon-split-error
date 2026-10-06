// Exports every decision note (DecisionNote) to a JSON file, so notes can be
// moved between databases (local -> Oracle) with scripts/notes-import.ts.
//
// Decision ids differ between local and Oracle, so each note is written by
// its decision's natural key instead: (source, sourceMatchId, gameIndex,
// eventId) — Match @@unique([source, sourceMatchId]), Game
// @@unique([matchId, gameIndex]), Decision @@unique([gameId, eventId]).
// eventId is a BigInt column, so it's written as a string.
//
// Read-only: uses prismaReadOnly (DATABASE_URL_READONLY), i.e. whichever DB
// .env's read-only URL points at. Prints that host (never credentials).
//
// Usage:
//   npx tsx scripts/notes-export.ts --out notes-export.json
//
// The output contains your personal notes. Don't commit it: .gitignore
// ignores notes-export*.json, so keep that prefix.
import "dotenv/config";
import fs from "node:fs";
import { prismaReadOnly } from "@/lib/prisma";
import type { ExportedNote } from "@/lib/decisionNotes";

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i === -1 ? undefined : process.argv[i + 1];
}

function hostOf(url: string | undefined): string {
  if (!url) return "(DATABASE_URL_READONLY not set)";
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}${parsed.port ? `:${parsed.port}` : ""}${parsed.pathname}`;
  } catch {
    return "(unparseable URL)";
  }
}

async function main() {
  const out = argValue("--out");
  if (!out) {
    console.error("Usage: npx tsx scripts/notes-export.ts --out <file.json>  (e.g. notes-export.json — never commit it)");
    process.exit(1);
  }

  console.log(`notes-export: reading from ${hostOf(process.env.DATABASE_URL_READONLY)} (DATABASE_URL_READONLY)`);

  const rows = await prismaReadOnly.decisionNote.findMany({
    orderBy: { id: "asc" },
    select: {
      note: true,
      createdAt: true,
      updatedAt: true,
      decision: {
        select: {
          eventId: true,
          game: { select: { gameIndex: true, match: { select: { source: true, sourceMatchId: true } } } },
        },
      },
    },
  });

  const notes: ExportedNote[] = rows.map((row) => ({
    source: row.decision.game.match.source,
    sourceMatchId: row.decision.game.match.sourceMatchId,
    gameIndex: row.decision.game.gameIndex,
    eventId: row.decision.eventId.toString(),
    note: row.note,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));

  fs.writeFileSync(out, `${JSON.stringify(notes, null, 2)}\n`);
  console.log(`notes-export: wrote ${notes.length} note${notes.length === 1 ? "" : "s"} to ${out}`);
}

main()
  .then(() => prismaReadOnly.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prismaReadOnly.$disconnect();
    process.exit(1);
  });
