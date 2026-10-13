# omp queue

Hand-offs between Claude Code (on `master`) and omp (on `omp/main` in `../backgammon-omp`). The rules are in AGENTS.md § Two worktrees, one local DB. Newest items at the top of each section. Done happens in two steps. When omp finishes a task, it adds an entry under "Done by omp (to check)" in its own copy on `omp/main`, giving the commit, what changed and which checks ran. That entry is how master knows to review. After the review, only master moves the item to "Checked and done (master)", with the date and commit, and queues any follow-ups as a new task. When omp next merges master, it deletes its "to check" entries for items that master has marked checked. If this file conflicts on a merge, omp keeps master's version and re-adds only its own new "to check" entries.

## Tasks for omp

### Review notes on `omp/main` at `8f8fd4b` (queued 2026-10-14)
Claude Code reviewed `7224f45` (with the merge `d6c146e`): the investigator checked the code and re-ran vitest (791/791) and tsc (clean); the visual-reviewer opened 15 screenshots in `design/screenshots/2026-10-13-review-followup-2/`. **No logic defects**, and the merge is right: every forum, review, notes and tags write is on `prismaApp`, gated by `isAppWriteEnabled()`, and `prisma/` matches master. Confirmed fixed: the checker chip wrapping at 390, the cube chip "·", the shared chip base with the ↗ affordance, the retry hint and the crossed-option radius, the "Next card" primary, "Recorded as Hard" in sans, the chip and "No" focus rings, the ReplyComposer comment, the reply POST header, the ReviewSession header, the button formatting and `aria-hidden`. What's left:

**1. Visual (Should).**
- **Tally count is still far right.** `proposalTallyChip` is `min-w-0 flex-1` (`forum.styles.ts:73`), so the chip takes all the free space and "1 vote" sits at the row's end (`forum-write-post-5-tally-open--1280-light--full.png`). Drop `flex-1` and add `items-center` on the row, so the count follows the chip and is centred on it.
- **The draft board is still narrow at 1280** (~358px in an ~880px column, `forum-write-post-5-checker-draft-open--1280-light--full.png`). `md:max-w-xl` on `proposalBoard` (`forum.styles.ts:75`) applies only to the modal. The draft's `CheckerMoveExplorer` (`ProposalDraft.tsx:31`) shrinks inside `proposalDraft`'s `items-start`. Make it `self-stretch w-full` with a `max-w-xl` cap.
- **The score breaks inside the chip at 390:** "2-/1 to play", "1–/0" (`forum-write-post-5--390-dark--full.png`), from `break-words` on `proposalPosition` (`forum.styles.ts:63`). Keep each score segment together (nowrap spans or non-breaking hyphen and dash), and let lines break only at "·".
- **Weak focus ring on the primary "Yes" button in dark** (`review-card1-reason-yes-focus--390-dark--viewport.png`): a dark halo on the near-black page. "No" is fine. Use a ring colour or offset that stands out against `paper` in both themes.
- **The Hard-only "Next card" fill looks dull grey-beige** (`review-hard-only-saved--390-dark--viewport.png`), duller than "Yes". Check whether the shot was taken mid-save (`disabled:opacity-45`). If it was, recapture after the save settles; if not, fix the fill. Also add a gap between "Recorded as Hard ·" and the Enter kbd, which butt together (`ReviewSession.tsx:636-637`), and match the kbd size to the label.

**2. Code.**
- Headers: "Enter is Next after a save" (`lib/reviewKeys.ts`) and "Enter advances only after the final save" (`ReviewSession.tsx` header) are true only for wrong answers and Hard-only cards. On unlimited and Hard/Good cards, Enter rates Good and advances. Say so.

**3. Could (do them if they're quick).** `gradeButton` `rounded-[11px]` (`review.styles.ts:108`) → `rounded-control`, `track` `rounded-[2px]` (line 22) → a token. Consider a borderless or dashed cube chip so it reads less like a button.

Checks: vitest, tsc, lint, build, `npm run test:visual`. Recapture the states you changed, open them, and list them under "Done by omp (to check)". Add a PROGRESS.md entry. When you merge master, clear your "to check" entries for the items listed under "Checked and done (master)" (see the rule at the top of this file).

## Schema requests (omp → master)

_Use this shape:_
- **Date / task:** …
- **Change:** table or column, type, nullable/default
- **Why:** …
- **Schema rule met:** 1, 2 or 3 (AGENTS.md § Schema rule)

## Done by omp (to check)

_Branch `omp/main` at commit …, what was done, which checks ran._

## Checked and done (master)

- **Review notes at `02831c2` (visual polish, comments, headers)**: `7224f45` (2026-10-14). Checked; the follow-ups are in the `8f8fd4b` task.
- **Review notes at `b657ca6` (screenshots, clean-up, master merge)**: `02831c2` + merge `d6c146e` (2026-10-14). Checked.
- **Phase 4 part 2: proposal APIs and real data**: `322b9a2` (2026-10-13). Reviewed; the follow-ups are in the task above.
- **Review: note-aware second try and "Do you know the reason?"**: `2e969ab` (2026-10-13). Reviewed; the follow-ups are in the task above.
- **Phase 4 part 1: helpers and UI, no DB**: `421d419` (2026-10-13).
