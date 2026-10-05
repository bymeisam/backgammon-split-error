// Read-only Galaxy API fetch for the investigator subagent (.claude/agents/
// investigator.md) — lets it check a claim against Galaxy's live API rather
// than only against what we stored. GET only, through the same
// lib/galaxy-client.ts the app uses; writes nothing anywhere and never prints
// the token. Needs a fresh GALAXY_TOKEN in .env (see .env.example).
//
// Usage:
//   npx tsx scripts/galaxy-get.ts list <page>
//   npx tsx scripts/galaxy-get.ts game <matchId> <gameIndex>
import "dotenv/config";
import { createGalaxyClient } from "@/lib/galaxy-client";

async function main() {
  const token = process.env.GALAXY_TOKEN;
  if (!token) {
    console.error("galaxy-get: GALAXY_TOKEN is not set — ask the user for a fresh one.");
    process.exit(1);
  }
  const client = createGalaxyClient(token);
  const [command, a, b] = process.argv.slice(2);

  let result: unknown;
  if (command === "list" && a) {
    result = await client.listMatches(Number(a));
  } else if (command === "game" && a && b !== undefined) {
    result = await client.getGameReviews(Number(a), Number(b));
  } else {
    console.error("usage: galaxy-get.ts list <page> | game <matchId> <gameIndex>");
    process.exit(1);
  }
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(`galaxy-get: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
