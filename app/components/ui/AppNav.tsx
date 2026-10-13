import { UserButton } from "@clerk/nextjs";
import { Suspense } from "react";
import { connection } from "next/server";
import { isGalaxyEnabled } from "@/lib/galaxyGate";
import { isAppWriteEnabled } from "@/lib/appWriteGate";
import { currentRuntimeModeLabel } from "@/lib/runtimeMode";
import { navItems } from "@/lib/navItems";
import type { AppRole } from "@/lib/appRole";
import { dueSplit } from "@/lib/review/queuePlan";
import NavLinks from "./NavLinks";
import ShortcutsHelp from "./ShortcutsHelp";
import { style } from "./AppNav.styles";

// The navbar's due-count badge: the /review header's "N new · N review"
// summed (today's daily limits applied, lib/review/queuePlan.ts), the same
// number as the dashboard's due widget. Owner with app writes on only (AppNav doesn't
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

// The app navbar, in the root layout: navigation, the mode badge, Settings,
// Status and "?". Rendered per request: the mode badge and the Sources item
// depend on the running server's env (not the build's), so connection()
// keeps it out of build-time prerendering. Only labels reach the client:
// the mode label, never DATABASE_URL or its host. (The sync line moved to
// the Galaxy card on /sources on 2026-10-09.)
// role (from the root layout): Review, Sources, Status, the due badge and the
// review shortcuts are the owner's only (lib/accessRules.ts).
export default async function AppNav({ role }: { role: AppRole | null }) {
  await connection();
  const galaxyEnabled = isGalaxyEnabled();
  // Sources follows the Galaxy/sync gate; the due badge and the review
  // shortcuts follow the app-write gate (lib/appWriteGate.ts).
  const ownerWrite = role === "OWNER" && isAppWriteEnabled();

  return (
    <NavLinks
      items={navItems(galaxyEnabled, role)}
      modeLabel={currentRuntimeModeLabel()}
      dueBadge={
        ownerWrite ? (
          <Suspense fallback={null}>
            <DueBadge />
          </Suspense>
        ) : null
      }
      help={<ShortcutsHelp writeEnabled={ownerWrite} />}
      account={<UserButton />}
    />
  );
}
