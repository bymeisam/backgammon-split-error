import Link from "next/link";
import { isGalaxyEnabled } from "@/lib/galaxyGate";
import { style } from "./home.styles";

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
