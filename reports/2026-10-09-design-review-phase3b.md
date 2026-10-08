# Design review: phase 3b sign-off (navbar fix and Settings polish, commit 4975ec4)

Checked against `reports/2026-10-09-design-review-phase3.md` sections (c) and (d).
Screenshots: `design/screenshots/2026-10-09-phase3b/`. Abbreviations: `cr/` = clubroom, `qi/` = quiet-ink, `mf/` = midnight-felt.

## (a) Checks

### Section (c): the navbar

| Check | Result | Evidence |
|---|---|---|
| The style entries match the spec (`md:` → `xl:`, `inner`, `narrowEnd`, `menu`, `list`, `endGroup`, `syncRow`, `footRow`, `syncBox`, `syncLabel`, `syncCount`, `syncMessage`, `helpButton`) | **Pass** | `app/components/ui/AppNav.styles.ts:16` and following, all as specified |
| `lastSyncedParts`, with the count moved into the tooltip from `xl` | **Pass** | `AppNav.tsx` (`NavSync`) passes `when`, `count` and `title`. `mf/nav-write-top--1440-*` shows "Synced 4 days ago" alone, and the 1024 sheet shows "Synced 4 days ago · 28 matches" (`mf/nav-write-menu-open--1024-dark`) |
| The sync result replaces the label instead of sitting beside it | **Pass** (code only) | `SyncControl.tsx`: `state.kind === "done"` ? message : label. No screenshot of this state, see (b) |
| Everything on one line, with nothing clipped, at 768, 1024 and 1440, write and read-only, all three themes, both modes | **Pass** | `nav-metrics-*.json`: `overflow` 0 and `menuOverflow` 0 in all 36 rows, and `endHeight` 30 (one row) at 1440. Visually: `mf/nav-write-top--1440-{light,dark}` |
| "Galaxy" at least 32px from the end group at 1440 | **Pass** | `linkToEnd` (write) is 105, 90 and 78px for Clubroom, Quiet Ink and Felt. Read-only is about 420px |
| Slack against my budget (+73 typical, Felt) | **Pass** | Measured slack is 73 / 58 / 46px (Clubroom / Quiet Ink / Felt). That's with the wider "Add token to sync" link, so the 46px for Felt is a lower bound for the token-less state |
| The 768 and 1024 panel opens on the right, 320px wide | **Pass** | `cr/nav-write-menu-open--768-light`, `mf/nav-write-menu-open--1024-dark`: a right-anchored, rounded-bottom panel; the sync row and the Settings / Status / "?" foot row are intact |
| Review › Cards dropdown at 1440 | **Pass** | `qi/nav-write-review-dropdown--1440-dark` |
| End cluster behind a hairline | **Pass** | A divider before Settings in every 1440 shot |

### Section (d): Settings

| Fix | Result | Evidence |
|---|---|---|
| 1. Mode segment visible in dark | **Pass** | "System" now lifts clearly with a ring, inside a ringed track (`cr/settings--390-dark--full`, `mf/settings--1440-dark--full`). Light mode is still clean (`qi/settings--390-light--full`) |
| 2. Value wrap at 390 | **Pass** | "At most 0.02 equity lost" stays on one line and the label wraps to "Correct-answer / threshold" (`qi/settings--390-light--full`, `cr/settings--390-dark--full`) |
| 3. Radios take the theme ink | **Pass** | The checked radio is ink-filled in both modes (`cr/settings--390-dark--full`: a cream dot; `qi/settings--390-light--full`: a black dot) |

## (b) New issues

None blocking.

- **Unseen state:** the sync result message (green or red) in the bar at 1440 wasn't captured, because no token was available. The arithmetic is fine. The message slot is capped at 160px, and with a token the "Add token to sync" link becomes the narrower "Sync now" button, so Felt keeps roughly its 46px of slack. If it gets tight, the slot's `truncate` absorbs it. Capture it once when a token is available. This doesn't block sign-off.
- **Unchecked radios in dark** still render as the browser's grey disc. `accent-color` only styles the checked state. This is cosmetic, and I'd leave it.
- **Not new, and noted only so nobody "fixes" it:** at 1440 the bar runs to 1240px, but Matches and Settings use `PageShell` `medium` (`max-w-4xl`, `app/components/ui/PageShell.styles.ts:31`), so their content stops about 300px short of the bar's right edge. It's intentional, left-aligned and consistent.

## (c) Verdict

**Yes. The theme work (phases 1–3) is complete.** Every check in (c) and (d) passes in all three themes, in both modes, at 768, 1024 and 1440. The only open item is the optional screenshot of the sync-result state above.
