import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 dark:bg-black">
      <main className="flex w-full max-w-xl flex-col gap-6 px-6 py-24 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
          Galaxy Game Review Dumper
        </h1>
        <p className="text-lg leading-7 text-zinc-600 dark:text-zinc-400">
          Fetch raw <code className="rounded bg-black/[.06] px-1 py-0.5 font-mono text-[0.9em] dark:bg-white/[.08]">game_reviews</code>{" "}
          JSON for a Backgammon Galaxy match, using a pasted curl or a token +
          match ID.
        </p>
        <div>
          <Link
            href="/matches"
            className="inline-flex h-11 items-center justify-center rounded-full bg-foreground px-6 text-base font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
          >
            Open tool
          </Link>
        </div>
      </main>
    </div>
  );
}
