import { Suspense } from "react";
import { connection } from "next/server";
import { isGalaxyEnabled } from "@/lib/galaxyGate";
import { currentRuntimeModeLabel } from "@/lib/runtimeMode";
import { navItems } from "@/lib/navItems";
import { dueSplit } from "@/lib/review/queuePlan";
import { latestFinishedSyncRun } from "@/lib/dashboardQueries";
import { lastSyncedLabel } from "@/lib/dashboardStats";
import NavLinks from "./NavLinks";
import SyncControl from "./SyncControl";
import ShortcutsHelp from "./ShortcutsHelp";
import { style } from "./AppNav.styles";

// The navbar's due-count badge: the /review header's "N new · N review"
// summed (today's daily limits applied, lib/review/queuePlan.ts), the same
// number as the dashboard's due widget. Write mode only (AppNav doesn't
// render it otherwise), so the read-only site never queries the review
// tables here. A DB error hides the badge instead of failing every page.
async function DueBadge() {
  let due: number;
  try {
    const split = await dueSplit(new Date());
    due = split.new + split.review;
  } catch (error) {
    console.error("[nav] due count failed:", error);
    return null;
  }
  return due > 0 ? (
    <span className={style.dueBadge} data-testid="nav-due-count">
      {due}
    </span>
  ) : null;
}

// "Synced …" plus the sync button. Write mode only. Only the label and
// the date leave the server.
async function NavSync() {
  const now = new Date();
  let label = "Last sync unknown";
  let title: string | undefined;
  try {
    const run = await latestFinishedSyncRun();
    label = lastSyncedLabel(run, now);
    title = run ? run.finishedAt.toLocaleString() : undefined;
  } catch (error) {
    console.error("[nav] last sync lookup failed:", error);
  }
  return <SyncControl lastSyncedLabel={label} lastSyncedTitle={title} />;
}

// The app navbar, in the root layout. Rendered per request: the mode badge
// and the Galaxy item depend on the running server's env (not the build's),
// so connection() keeps it out of build-time prerendering. Only labels
// reach the client: the mode label, never DATABASE_URL or its host.
export default async function AppNav() {
  await connection();
  const galaxyEnabled = isGalaxyEnabled();

  return (
    <NavLinks
      items={navItems(galaxyEnabled)}
      modeLabel={currentRuntimeModeLabel()}
      dueBadge={
        galaxyEnabled ? (
          <Suspense fallback={null}>
            <DueBadge />
          </Suspense>
        ) : null
      }
      syncControl={
        galaxyEnabled ? (
          <Suspense fallback={null}>
            <NavSync />
          </Suspense>
        ) : null
      }
      help={<ShortcutsHelp writeEnabled={galaxyEnabled} />}
    />
  );
}
