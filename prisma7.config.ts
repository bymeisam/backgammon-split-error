// Prisma 7's CLI finds this file by name on its own (@prisma/config looks for
// prisma7.config.{ts,js,...} in the project root before prisma.config.*), so
// no --config flag or package.json key is needed. Loaded through c12/jiti,
// hence the relative import below (no "@/" alias).
import "dotenv/config";
import { defineConfig } from "prisma/config";
import { dbUrl } from "./lib/databaseUrl";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // DB_TARGET's read-write URL (lib/databaseUrl.ts): local unless the user
    // has set DB_TARGET=oracle, so `prisma migrate deploy` and friends follow
    // the flag. Agents never set DB_TARGET=oracle.
    url: dbUrl("rw"),
  },
});
