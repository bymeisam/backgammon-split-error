import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 dark:bg-black">
      <main className="flex w-full max-w-xl flex-col gap-6 px-6 py-24 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
          Galaxy Game Review Dumper
        </h1>
        <p className="text-lg leading-7 text-zinc-600 dark:text-zinc-400">
          Browse PR and mistake breakdowns for your Backgammon Galaxy matches,
          synced into a local database.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/matches"
            className="inline-flex h-11 items-center justify-center rounded-full bg-foreground px-6 text-base font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
          >
            Open tool
          </Link>
          <Link
            href="/galaxy/matches"
            className="inline-flex h-11 items-center justify-center rounded-full border border-black/10 px-6 text-base font-medium text-black transition-colors hover:bg-black/[.04] dark:border-white/15 dark:text-zinc-100 dark:hover:bg-white/[.06]"
          >
            Fetch live from Galaxy
          </Link>
        </div>
      </main>
    </div>
  );
}
