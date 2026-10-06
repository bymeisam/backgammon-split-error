// Imports decision notes written by scripts/notes-export.ts into whichever
// DB DATABASE_URL points at (read-write `prisma` client). Prints that host
// (never credentials) so you can see which DB it hit.
//
// Each entry's decision is resolved in the target DB by its natural key
// (source, sourceMatchId, gameIndex, eventId) — Decision ids differ between
// local and Oracle. Per entry, exactly one outcome:
//   new       — the decision has no note yet: create it.
//   updated   — the incoming updatedAt is strictly newer than the existing
//               note's: overwrite it.
//   skipped   — the existing note is the same age or newer: leave it alone.
//   unmatched — the decision isn't in this DB: nothing to attach to.
// new/updated rows keep the incoming createdAt/updatedAt (an explicitly set
// value overrides Prisma's @updatedAt), so a note keeps its real
// timestamps across databases and re-imports stay idempotent.
//
// Usage:
//   npx tsx scripts/notes-import.ts --in notes-export.json --dry-run   # report only, writes nothing
//   npx tsx scripts/notes-import.ts --in notes-export.json             # actually write
//
// Never commit the notes file (.gitignore ignores notes-export*.json).
import "dotenv/config";
import fs from "node:fs";
import { prisma } from "@/lib/prisma";
import { importOutcome, type ExportedNote, type ImportOutcome } from "@/lib/decisionNotes";

const DRY_RUN = process.argv.includes("--dry-run");

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i === -1 ? undefined : process.argv[i + 1];
}

function hostOf(url: string | undefined): string {
  if (!url) return "(DATABASE_URL not set)";
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}${parsed.port ? `:${parsed.port}` : ""}${parsed.pathname}`;
  } catch {
    return "(unparseable URL)";
  }
}

function keyOf(e: ExportedNote): string {
  return `${e.source}/${e.sourceMatchId} game ${e.gameIndex} event ${e.eventId}`;
}

// Throws on anything that isn't a well-formed export entry, rather than
// importing half a file.
function parseEntries(raw: unknown): ExportedNote[] {
  if (!Array.isArray(raw)) throw new Error("notes file must be a JSON array.");
  return raw.map((e, i) => {
    const ok =
      e !== null &&
      typeof e === "object" &&
      typeof e.source === "string" &&
      typeof e.sourceMatchId === "string" &&
      Number.isInteger(e.gameIndex) &&
      typeof e.eventId === "string" &&
      /^\d+$/.test(e.eventId) &&
      typeof e.note === "string" &&
      e.note.trim().length > 0 &&
      typeof e.createdAt === "string" &&
      !Number.isNaN(Date.parse(e.createdAt)) &&
      typeof e.updatedAt === "string" &&
      !Number.isNaN(Date.parse(e.updatedAt));
    if (!ok) throw new Error(`entry ${i} is malformed: ${JSON.stringify(e)}`);
    return e as ExportedNote;
  });
}

async function main() {
  const file = argValue("--in");
  if (!file) {
    console.error("Usage: npx tsx scripts/notes-import.ts --in <file.json> [--dry-run]");
    process.exit(1);
  }

  const entries = parseEntries(JSON.parse(fs.readFileSync(file, "utf8")));
  console.log(
    `notes-import: ${DRY_RUN ? "DRY RUN (no writes) " : ""}targeting ${hostOf(process.env.DATABASE_URL)} (DATABASE_URL), ${entries.length} entr${entries.length === 1 ? "y" : "ies"} from ${file}`
  );

  const counts: Record<ImportOutcome | "unmatched", number> = { new: 0, updated: 0, skipped: 0, unmatched: 0 };
  const unmatched: string[] = [];

  for (const entry of entries) {
    const decision = await prisma.decision.findFirst({
      where: {
        eventId: BigInt(entry.eventId),
        game: {
          gameIndex: entry.gameIndex,
          match: { source: entry.source, sourceMatchId: entry.sourceMatchId },
        },
      },
      select: { id: true, note: { select: { updatedAt: true } } },
    });

    if (!decision) {
      counts.unmatched++;
      unmatched.push(keyOf(entry));
      continue;
    }

    const createdAt = new Date(entry.createdAt);
    const updatedAt = new Date(entry.updatedAt);
    const outcome = importOutcome(decision.note?.updatedAt ?? null, updatedAt);
    counts[outcome]++;
    if (outcome !== "skipped") console.log(`  ${outcome}: ${keyOf(entry)}`);
    if (DRY_RUN || outcome === "skipped") continue;

    if (outcome === "new") {
      await prisma.decisionNote.create({
        data: { decisionId: decision.id, note: entry.note, createdAt, updatedAt },
      });
    } else {
      await prisma.decisionNote.update({
        where: { decisionId: decision.id },
        data: { note: entry.note, createdAt, updatedAt },
      });
    }
  }

  console.log(
    `notes-import: new=${counts.new} updated=${counts.updated} skipped=${counts.skipped} unmatched=${counts.unmatched}${DRY_RUN ? " (dry run, nothing written)" : ""}`
  );
  for (const key of unmatched) console.log(`  unmatched: ${key}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
