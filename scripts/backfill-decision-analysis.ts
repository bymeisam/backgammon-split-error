// Backfill: fills Decision.analysis (the source-neutral, versioned analysis
// the review cards read — lib/analysis/types.ts) for every already-ingested
// counted decision, from the row's own stored `raw`, with the same
// translator lib/ingest.ts uses (lib/analysis/galaxy.ts's galaxyAnalysis).
// See docs/field-mapping.md, "Decision.analysis".
//
// Scope: counted decisions only (countAsDecision = 1 AND rawError IS NOT
// NULL), the same as ingest. Resignations and unrecognised shapes translate
// to null, so they stay NULL. Rows outside the scope aren't touched.
//
// Idempotent: writes only rows whose stored value differs from the
// translator's (NULL, an older `v`, or different content), so a second run
// finds 0 to write. A translator change that bumps `v` is picked up the same
// way.
//
// No live Galaxy calls. Memory and transfer: selects only the JSON paths the
// translator reads — never all of `raw`, which ran out of memory before (see
// backfill-source-position-id.ts) — batched by Match.id range like
// backfill-decision-cube-from-match-id.ts. For moves, JSON_TABLE rebuilds
// each candidate server-side with just the 9 fields galaxyAnalysis reads
// (JSON-typed columns, so values and types are Galaxy's own); the full
// candidate objects (error_analysis, final, ...) averaged 2.4 KB per row,
// about 1.2 GB per scan locally, which matters over the network to Oracle.
// A missing field comes back as JSON null, which the translator rejects
// exactly as it would a missing one. Candidate order doesn't matter: the
// translator sorts by equity and rank.
//
// Writes: batched multi-row UPDATEs, a few hundred rows per statement
// (UPDATE ... JOIN (VALUES ROW(?, ?), ...)), because one-row-at-a-time
// updates are far too slow over the network to Oracle. VALUES needs MySQL
// 8.0.19+. Each statement commits on its own, so an interrupted run leaves
// a consistent, partly-filled column; re-running picks up the rest.
//
// Usage:
//   npx tsx scripts/backfill-decision-analysis.ts --dry-run   # count only
//   npx tsx scripts/backfill-decision-analysis.ts             # write
//   npx tsx scripts/backfill-decision-analysis.ts --rows-per-update=300
//
// Runs against whatever DATABASE_URL is currently configured in .env (the
// host is printed first, never the credentials). Review the dry run first.
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { galaxyAnalysis } from "@/lib/analysis/galaxy";
import type { DecisionAnalysis } from "@/lib/analysis/types";

const DRY_RUN = process.argv.includes("--dry-run");
const ROWS_ARG = process.argv.find((a) => a.startsWith("--rows-per-update="));
const ROWS_PER_UPDATE = ROWS_ARG ? Number(ROWS_ARG.split("=")[1]) : 500;
const MATCH_BATCH = 100;
const EXAMPLE_LIMIT = 5;

if (!Number.isInteger(ROWS_PER_UPDATE) || ROWS_PER_UPDATE < 1 || ROWS_PER_UPDATE > 2000) {
  console.error("--rows-per-update must be an integer from 1 to 2000");
  process.exit(1);
}

interface Row {
  id: number;
  analysedEvent: string;
  moves: unknown;
  nd: unknown;
  dt: unknown;
  dp: unknown;
  analysis: unknown;
}

// The driver may hand JSON values back as text or already parsed.
function parseJson(v: unknown): unknown {
  if (typeof v !== "string") return v ?? null;
  try {
    return JSON.parse(v);
  } catch {
    return v;
  }
}

// Key-order-independent JSON text (MySQL's JSON type reorders keys).
function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (v !== null && typeof v === "object") {
    const entries = Object.entries(v as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, x]) => `${JSON.stringify(k)}:${canonical(x)}`).join(",")}}`;
  }
  return JSON.stringify(v);
}

function hostOf(url: string | undefined): string {
  if (!url) return "(DATABASE_URL not set)";
  try {
    const u = new URL(url);
    return `${u.hostname}:${u.port || "3306"}${u.pathname}`;
  } catch {
    return "(unparseable DATABASE_URL)";
  }
}

async function writeChunk(chunk: { id: number; json: string | null }[]): Promise<number> {
  // VALUES' columns are named column_0, column_1 (works on every 8.0.19+,
  // without relying on a derived-table column list).
  const rows = chunk.map(() => "ROW(?, ?)").join(", ");
  const sql =
    `UPDATE Decision d JOIN (VALUES ${rows}) AS v ON d.id = v.column_0 ` +
    `SET d.\`analysis\` = CAST(v.column_1 AS JSON)`;
  const params = chunk.flatMap((r) => [r.id, r.json]);
  return prisma.$executeRawUnsafe(sql, ...params);
}

async function main() {
  const started = Date.now();
  console.log(`Target: ${hostOf(process.env.DATABASE_URL)}`);
  console.log(DRY_RUN ? "DRY RUN — counting only, nothing will be written.\n" : "LIVE RUN — will write changes.\n");

  const [{ maxMatchId }] = await prisma.$queryRaw<{ maxMatchId: number | null }[]>`
    SELECT MAX(id) AS maxMatchId FROM \`Match\`
  `;

  let scanned = 0;
  const targetByKind: Record<string, number> = { checker: 0, cube: 0, null: 0 };
  const nullByEvent: Record<string, number> = {};
  const reasons: Record<string, number> = { storedNull: 0, olderVersion: 0, otherVersion: 0, differs: 0, toNull: 0 };
  const differsExamples: string[] = [];
  const nullExamples: string[] = [];
  let toWrite = 0;
  let written = 0;
  let updateStatements = 0;
  let scanMs = 0;
  let writeMs = 0;

  for (let lo = 0; lo < (maxMatchId ?? 0); lo += MATCH_BATCH) {
    const t0 = Date.now();
    const rows = await prisma.$queryRaw<Row[]>`
      SELECT d.id, d.analysedEvent,
             CASE WHEN d.analysedEvent = 'move' THEN (
               SELECT JSON_ARRAYAGG(JSON_OBJECT(
                        'notation', jt.notation, 'rank', jt.rnk, 'equity', jt.equity, 'move_played', jt.played,
                        'probabilities', JSON_OBJECT('win', jt.win, 'win_gammon', jt.wg, 'win_backgammon', jt.wbg,
                                                     'lose_gammon', jt.lg, 'lose_backgammon', jt.lbg)))
               FROM JSON_TABLE(d.raw, '$.reviews[0].result.result.moves[*]' COLUMNS (
                      notation JSON PATH '$.notation', rnk JSON PATH '$.rank', equity JSON PATH '$.equity',
                      played JSON PATH '$.move_played',
                      win JSON PATH '$.probabilities.win', wg JSON PATH '$.probabilities.win_gammon',
                      wbg JSON PATH '$.probabilities.win_backgammon', lg JSON PATH '$.probabilities.lose_gammon',
                      lbg JSON PATH '$.probabilities.lose_backgammon')) AS jt
             ) END AS moves,
             CASE WHEN d.analysedEvent IN ('cube_double', 'cube_pass')
                  THEN JSON_EXTRACT(d.raw, '$.reviews[0].result.result.cube_analysis.no_double') END AS nd,
             CASE WHEN d.analysedEvent IN ('cube_double', 'cube_pass')
                  THEN JSON_EXTRACT(d.raw, '$.reviews[0].result.result.cube_analysis.double_take') END AS dt,
             CASE WHEN d.analysedEvent IN ('cube_double', 'cube_pass')
                  THEN JSON_EXTRACT(d.raw, '$.reviews[0].result.result.cube_analysis.double_pass') END AS dp,
             d.analysis
      FROM Decision d JOIN Game g ON g.id = d.gameId
      WHERE g.matchId > ${lo} AND g.matchId <= ${lo + MATCH_BATCH}
        AND d.countAsDecision = 1 AND d.rawError IS NOT NULL
    `;
    scanMs += Date.now() - t0;

    const pending: { id: number; json: string | null }[] = [];
    for (const r of rows) {
      scanned++;
      // A minimal raw with only the paths galaxyAnalysis reads.
      const raw = {
        reviews: [
          {
            result: {
              result: {
                moves: parseJson(r.moves),
                cube_analysis: { no_double: parseJson(r.nd), double_take: parseJson(r.dt), double_pass: parseJson(r.dp) },
              },
            },
          },
        ],
      };
      const target: DecisionAnalysis | null = galaxyAnalysis(raw, r.analysedEvent);
      targetByKind[target ? target.kind : "null"]++;
      if (!target) {
        nullByEvent[r.analysedEvent] = (nullByEvent[r.analysedEvent] ?? 0) + 1;
        if (r.analysedEvent !== "resignation" && nullExamples.length < EXAMPLE_LIMIT) {
          nullExamples.push(`  id ${r.id} (${r.analysedEvent})`);
        }
      }

      const stored = parseJson(r.analysis);
      if (canonical(stored) === canonical(target)) continue;

      if (target === null) reasons.toNull++;
      else if (stored === null) reasons.storedNull++;
      else {
        const v = (stored as { v?: unknown }).v;
        if (typeof v === "number" && v < target.v) reasons.olderVersion++;
        else if (v !== target.v) reasons.otherVersion++;
        else {
          reasons.differs++;
          if (differsExamples.length < EXAMPLE_LIMIT) differsExamples.push(`  id ${r.id} (${r.analysedEvent})`);
        }
      }
      pending.push({ id: r.id, json: target === null ? null : JSON.stringify(target) });
    }
    toWrite += pending.length;

    if (!DRY_RUN && pending.length > 0) {
      const t1 = Date.now();
      for (let i = 0; i < pending.length; i += ROWS_PER_UPDATE) {
        written += await writeChunk(pending.slice(i, i + ROWS_PER_UPDATE));
        updateStatements++;
      }
      writeMs += Date.now() - t1;
    }
    process.stdout.write(
      `\rMatches up to id ${Math.min(lo + MATCH_BATCH, maxMatchId ?? 0)} / ${maxMatchId}: ${scanned} scanned, ${toWrite} to write${DRY_RUN ? "" : `, ${written} written`}`
    );
  }

  console.log("\n\n=== Scan ===");
  console.log(`Counted decisions scanned: ${scanned}`);
  console.log(`Translator result by kind: checker ${targetByKind.checker}, cube ${targetByKind.cube}, null ${targetByKind.null}`);
  console.log("Null results by analysedEvent:", nullByEvent);
  if (nullExamples.length > 0) {
    console.log("Examples of non-resignation null results (expected none):");
    for (const e of nullExamples) console.log(e);
  }
  console.log(`Rows to write: ${toWrite}`);
  console.log(
    `  stored NULL: ${reasons.storedNull}, older v: ${reasons.olderVersion}, other v: ${reasons.otherVersion}, same v but different: ${reasons.differs}, set to NULL: ${reasons.toNull}`
  );
  if (differsExamples.length > 0) {
    console.log("Examples of same-v rows that differ:");
    for (const e of differsExamples) console.log(e);
  }

  const [{ outOfScope }] = await prisma.$queryRaw<{ outOfScope: bigint }[]>`
    SELECT COUNT(*) AS outOfScope FROM Decision
    WHERE analysis IS NOT NULL AND NOT (countAsDecision = 1 AND rawError IS NOT NULL)
  `;
  console.log(`Rows outside the scope with a non-null analysis (expected 0, not touched): ${Number(outOfScope)}`);

  console.log("\n=== Summary ===");
  if (DRY_RUN) console.log("(dry run — nothing was written)");
  else {
    console.log(`Rows written: ${written} in ${updateStatements} UPDATE statements of up to ${ROWS_PER_UPDATE} rows`);
    console.log(`Write time: ${(writeMs / 1000).toFixed(1)}s`);
  }
  console.log(`Scan (SELECT) time: ${(scanMs / 1000).toFixed(1)}s over ${Math.ceil((maxMatchId ?? 0) / MATCH_BATCH)} batches`);
  console.log(`Total time: ${((Date.now() - started) / 1000).toFixed(1)}s`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
