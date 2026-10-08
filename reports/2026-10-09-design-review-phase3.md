# Design review: Phase 2 fixes and Phase 3 (Settings)

Date: 2026-10-09. Commit 4703637. Screenshots: `design/screenshots/2026-10-09-phase3/{clubroom,quiet-ink,midnight-felt}/` (abbreviated `cr/`, `qi/`, `mf/` below).

## (a) The three themes after the fixes

| Theme | Verdict |
|---|---|
| **Quiet Ink, dark** | **Pass.** The lifted bone #b4b8bf now reads as light grey rather than slate, and the arrows keep their hue. Error #835500 reads ochre, not brown, and its arrowhead stands out on both the bone and the dark points (`qi/replay-checker-error-move2--1440-dark--viewport.png`). The white checkers still separate from the bone thanks to their rim. This was the one failure in Phase 2, and it's fixed. |
| **Quiet Ink, light** | Pass, unchanged. Upright "Correct." in Best ink works better than an oblique would (`qi/settings--390-light--full.png`, Quiet Ink preview). |
| **Midnight Felt, both modes** | **Pass.** The pewter rim #9a9584 outlines the dark checkers on felt and on oxblood points, and the stacks on 6/8/9 count at a glance (`mf/replay-checker-with-cube-move15--1440-light--viewport.png`, `mf/review-card1-back-correct--1440-dark--viewport.png`). With the opaque halo, the light arrows sit cleanly over the dark checkers. |
| **Clubroom** | Pass. The opaque halo is a small change and doesn't harm anything. |
| Lining figures, display weight, emphasis | Correct in every theme. The Felt and Clubroom titles keep their italic "vs". Quiet Ink's 600 weight restores its hierarchy (`qi/replay-checker-error-move2--1440-dark--viewport.png`, "Game 2 vs cbj2"). |

**The only defect left is the navbar.** It's visible in nearly every 1440 write-mode screenshot:
- The sync line wraps onto two lines in **Felt and in Quiet Ink** (`qi/replay-checker-error-move2--1440-dark--viewport.png`, `mf/settings--1440-dark--full.png`). The developer measured 13px to spare in Quiet Ink, but the replay page wraps there too.
- "Galaxy" runs into the mode badge ("Galaxy● Local · write"). The cause is that the `menu` row has no minimum gap between `list` and `endGroup`: `ml-auto` collapses to 0 when the bar is full (`AppNav.styles.ts:50-52, 82`).

## (b) The Settings page

**It works and it's calm.** There are three cards (Theme, Mode, Review), each with an overline and a one-line note. The three-up picker becomes a stack at 390, and the read-only limits table is plain and clear.

- **Previews: good.** Each one is truly scoped to its theme and follows the page's mode. The dark page shows dark previews (`cr/settings--390-dark--full.png`), which is honest. The font line under each card is useful. At 20px the mini-board is only a hint, and on dark Felt the dark checker almost disappears (`mf/settings--1440-dark--full.png`). That's acceptable.
- **Selection: clear.** The chosen card has a 1px ink border and the native radio is filled.
- **Mode control: weak in dark.** The chosen segment is `bg-surface` on `bg-sunken`, which are nearly the same colour in dark mode, so "System" barely lifts (`cr/settings--390-dark--full.png`, `mf/settings--1440-dark--full.png`). It reads fine in light mode. Fix 1 below.
- **At 390:**
  - "At most 0.02 equity lost" breaks raggedly into "equity / lost" against a wrapped label (`qi/settings--390-light--full.png`). Fix 2.
  - Everything else fits.
- **Native radios** in dark render as grey-filled discs that ignore the theme. Fix 3 is cosmetic.

## (c) Navbar fix: collapse below `xl`, a bounded sync slot, and an end cluster

### Why not `lg`

Content width is 976px at 1024 (with `px-6`) and 1192px at 1240 and above, where the 1240px max-width cap takes effect. Write mode at 1024 needs about:
- brand 150;
- 6 links with the badge, about 440;
- gaps 56;
- end group about 480 (mode 85, sync about 225, Settings, Status and "?" about 140, plus gaps).

That's about 1,130px, which is 150px more than the bar has. So `lg` would only fix read-only.

At `xl` (1280) the inner bar is already at its 1240 cap, so **the full bar only ever renders at its maximum width**, and the budget below holds for every width from 1280 up. Below 1280, including 768 and 1024, the bar shows the Menu button. A gear icon saves 17px and fixes nothing on its own.

### Space budget at 1440, write mode, Felt (the widest theme, 0px spare today)

| Change | px |
|---|---|
| Minimum 32px gap between the links and the end group (`xl:gap-8` on `menu`) | −32 |
| Brand-to-links gap 32 → 24 (`xl:gap-6` on `inner`) | +8 |
| Link gap 22 → 20 (`xl:gap-5`) | +10 |
| End-group and sync-box gaps 16 → 12 (four gaps), plus a 25px divider into the cluster | +7 |
| " · 28 matches" moved into the tooltip at `xl`, so the label becomes "Synced 4 days ago" (typical) | +80 |
| **Spare: typical / worst case** (the label slot truncates at 160px, and a sync message replaces the label rather than appearing beside it) | **+73 / +18** |

Clubroom has 28px more spare and Quiet Ink 13px more. The width is now bounded, so a longer label or a sync error can't wrap the bar again.

### Spec: `app/components/ui/AppNav.styles.ts`

Change every `md:` prefix to `xl:` in `modeBadge`, `narrowEnd`, `menu`, `list`, `item`, `itemWithChildren`, `link`, `subList`, `subLink`, `endGroup`, `syncRow`, `footRow` and `helpButton`. Then set these entries exactly:

```ts
inner: "relative mx-auto flex h-14 w-full max-w-[1240px] items-center gap-3 px-4 md:px-6 xl:gap-6",
narrowEnd: "ml-auto flex items-center gap-3 xl:hidden",
// Below xl: a sheet under the bar. Full width below md; from md to xl a
// 320px panel anchored to the right edge (no stretched phone sheet at 1024).
// From xl: the row, with a guaranteed 32px between the links and the end.
menu: (open: boolean): string =>
  clsx(
    "absolute inset-x-0 top-full flex-col border-b border-line bg-surface pb-1 shadow-raised",
    "md:left-auto md:right-6 md:w-80 md:rounded-b-card md:border-x",
    "xl:static xl:flex xl:h-full xl:w-auto xl:flex-1 xl:flex-row xl:items-center xl:gap-8 xl:rounded-none xl:border-x-0 xl:border-b-0 xl:bg-transparent xl:pb-0 xl:shadow-none",
    open ? "flex" : "hidden"
  ),
list: "flex flex-col py-1 xl:h-full xl:flex-row xl:gap-5 xl:py-0",
endGroup:
  "flex flex-col border-t border-line text-[12.5px] text-ink-faint xl:ml-auto xl:flex-row xl:items-center xl:gap-3 xl:whitespace-nowrap xl:border-t-0",
syncRow: "px-4 py-3 xl:contents",
// The end cluster: Settings, Status and "?" behind a hairline from xl; the
// sheet's foot row below it.
footRow: "flex items-center gap-5 border-t border-line px-4 py-2 xl:gap-3 xl:border-l xl:border-t-0 xl:py-0 xl:pl-3 xl:pr-0",
syncBox: "flex flex-wrap items-center gap-x-4 gap-y-2 text-[12.5px] text-ink-faint xl:flex-nowrap xl:gap-x-3",
// The label slot: "Synced 4 days ago", bounded so the bar can't wrap.
syncLabel: "max-w-64 truncate xl:max-w-40",
// " · 28 matches": shown in the sheet, in the tooltip only from xl.
syncCount: "xl:hidden",
syncMessage: (ok: boolean): string =>
  clsx("max-w-64 truncate xl:max-w-40", ok ? "text-best-ink" : "text-blunder-ink"),
helpButton:
  "ml-auto inline-flex h-[30px] w-[30px] items-center justify-center rounded-[8px] border border-line text-[13px] font-semibold text-ink-muted transition-colors hover:bg-sunken hover:text-ink xl:ml-0",
```

### Spec: the logic changes

- **`lib/dashboardStats.ts`:** add `lastSyncedParts(run, now)`, which returns `{ when: "Synced 4 days ago", count: " · 28 matches" }`, or `{ when: "Never synced", count: "" }` when there's no run. Keep `lastSyncedLabel` as `when + count` so its tests and the dashboard don't change.
- **`AppNav.tsx` (`NavSync`):** pass `when`, `count` and a title `${finishedAt.toLocaleString()} · 28 matches` to `SyncControl`.
- **`SyncControl.tsx`:**
  - render `<span className={style.syncLabel} title=…>{when}<span className={style.syncCount}>{count}</span></span>`;
  - once `state.kind === "done"`, render the `role="status"` message **in place of** that label span, not after the button.
- **Check after the change:**
  - 768, 1024 and 1440, in write and read-only mode, in all three themes and both modes: one line, nothing clipped, and "Galaxy" at least 32px from the mode badge;
  - the 768 and 1024 panel opens on the right;
  - the Review › Cards dropdown still opens at 1440.

## (d) Last fixes (all S, `app/settings/settings.styles.ts`)

1. **Mode segment in dark:**
   - In `modeOption`'s selected branch, use `"bg-surface text-ink shadow-card ring-1 ring-inset ring-line-strong"`.
   - Also change `modeTrack` from `bg-sunken` to `bg-sunken ring-1 ring-inset ring-line`.
2. **The 390 value wrap:** add `whitespace-nowrap` to `rowValue`, so the label wraps instead ("Correct-answer / threshold" next to an intact "At most 0.02 equity lost").
3. **Radios:** add `accent-ink` to `themeRadio`, so the native radio takes the theme's ink in both modes.

## (e) Verdict

**Yes, the theme work is complete once the navbar fix lands**, with the three small Settings fixes alongside it in the same spec. All three themes pass on the board in both modes. Quiet Ink dark and the Felt checkers, the two open issues, are resolved.

**Open:**
- I couldn't see 768 or 1024. No screenshots exist at those widths, so the budget figures are computed from the 1440 measurements.
- **Add 1024 and 768 navbar shots** (write and read-only) to `scripts/design-screenshots.ts` before the final sign-off.
