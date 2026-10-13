/**
 * The URL prismaApp (lib/prisma.ts) connects with: DATABASE_URL_APP, or
 * outside production DATABASE_URL (so local write mode keeps working without
 * a separate user). Production never falls back to the admin credential. An
 * empty DATABASE_URL_APP counts as unset, as it does in isAppWriteEnabled().
 *
 * Its own module, with no Prisma import, so the navbar's mode badge
 * (lib/runtimeMode.ts) can read it without pulling the client in. lib/prisma.ts
 * re-exports it.
 */
export function appDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string | undefined {
  return env.DATABASE_URL_APP || (env.NODE_ENV === "production" ? undefined : env.DATABASE_URL);
}
