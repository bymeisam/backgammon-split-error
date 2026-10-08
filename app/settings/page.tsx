import { cookies } from "next/headers";
import PageShell from "@/app/components/ui/PageShell";
import Card from "@/app/components/ui/Card";
import { THEME_COOKIE, themeSettingsFromCookie } from "@/lib/themes";
import {
  BULK_ADD_CAP,
  CORRECT_LOSS_THRESHOLD,
  NEW_CARDS_PER_DAY,
  REVIEW_BATCH_SIZE,
  REVIEWS_PER_DAY,
} from "@/lib/settings";
import ThemeSettings from "./ThemeSettings";
import { style } from "./settings.styles";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className={style.rowWrapper}>
      <span className={style.rowLabel}>{label}</span>
      <span className={style.rowValue}>{value}</span>
    </div>
  );
}

// /settings: the display theme and mode (a per-browser cookie, so it works
// on the read-only site too; no DB), and the review settings from
// lib/settings.ts, shown read-only for now.
export default async function SettingsPage() {
  const current = themeSettingsFromCookie((await cookies()).get(THEME_COOKIE)?.value);

  return (
    <PageShell width="medium" title="Settings" subtitle="How the app looks in this browser, and how review works.">
      <ThemeSettings initial={current} />

      <Card as="section" className={style.section} aria-labelledby="settings-review">
        <div className={style.sectionHead}>
          <h2 id="settings-review" className={style.sectionTitle}>
            Review
          </h2>
          <p className={style.sectionNote}>Read-only for now. These will be editable here later.</p>
        </div>
        <div className={style.rowList}>
          <Row label="New cards per day" value={NEW_CARDS_PER_DAY.toLocaleString("en")} />
          <Row label="Reviews per day" value={REVIEWS_PER_DAY.toLocaleString("en")} />
          <Row label="Cards per batch" value={REVIEW_BATCH_SIZE.toLocaleString("en")} />
          <Row label="Correct-answer threshold" value={`At most ${CORRECT_LOSS_THRESHOLD} equity lost`} />
          <Row label="Most cards added at once" value={BULK_ADD_CAP.toLocaleString("en")} />
        </div>
      </Card>
    </PageShell>
  );
}
