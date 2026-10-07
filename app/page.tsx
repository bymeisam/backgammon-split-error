import { Suspense } from "react";
import Link from "next/link";
import { isGalaxyEnabled } from "@/lib/galaxyGate";
import { prismaReadOnly } from "@/lib/prisma";
import { startOfNextLocalDay } from "@/lib/review/queue";
import { style } from "./home.styles";

// Rendered per request: the Galaxy link and the review count depend on the
// running server's env and DB, not the build's.
export const dynamic = "force-dynamic";

// Unsuspended cards due today (the (suspended, due) index; before today's
// daily limits — the /review header shows the limited counts). Write mode
// only: the read-only site links to the card list without a count.
async function DueCount() {
  const due = await prismaReadOnly.reviewCard.count({
    where: { suspended: false, due: { lt: startOfNextLocalDay(new Date()) } },
  });
  return due > 0 ? <span className={style.dueBadge}>{due}</span> : null;
}

export default function Home() {
  const galaxyEnabled = isGalaxyEnabled();

  return (
    <div className={style.pageContainer}>
      <main className={style.main}>
        <h1 className={style.title}>
          Galaxy Game Review Dumper
        </h1>
        <p className={style.subtitle}>
          Browse PR and mistake breakdowns for your Backgammon Galaxy matches,
          synced into a local database.
        </p>
        <div className={style.buttonRow}>
          <Link href="/matches" className={style.primaryButton}>
            Open tool
          </Link>
          <Link href={galaxyEnabled ? "/review" : "/review/cards"} className={style.secondaryButton}>
            Review
            {galaxyEnabled && (
              <Suspense fallback={null}>
                <DueCount />
              </Suspense>
            )}
          </Link>
          {galaxyEnabled && (
            <Link href="/galaxy/matches" className={style.secondaryButton}>
              Fetch live from Galaxy
            </Link>
          )}
        </div>
        <Link href="/status" className={style.statusLink}>
          Status
        </Link>
      </main>
    </div>
  );
}
