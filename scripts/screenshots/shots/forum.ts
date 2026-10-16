import { expect } from "@playwright/test";
import { FORUM_DECISION, FORUM_POSTS, MATCH, REPLAY_CHECKER_ERROR } from "../config";
import { open, openReplay, type Shot, type ShotContext } from "../helpers";
import { navMode } from "../nav";

// The forum set (--set=forum). Every name starts with forum-<mode>- (the
// server's write mode, from the navbar's badge) so the write-on and
// write-off runs land side by side in one folder.
async function forumShoot(ctx: ShotContext, name: string, mode: "full" | "viewport"): Promise<void> {
  await ctx.shoot(`forum-${await navMode(ctx.page)}-${name}`, mode);
}
async function forumActionShot(ctx: ShotContext, name: string, mode: "full" | "viewport" = "full"): Promise<void> {
  await ctx.page.getByRole("button", { name: "Post to forum" }).first().scrollIntoViewIfNeeded();
  await forumShoot(ctx, name, mode);
}

export const FORUM_SHOTS: Shot[] = [
  {
    name: "forum-list",
    run: async (ctx) => {
      await open(ctx.page, "/forum");
      await forumShoot(ctx, "list", "full");
    },
  },
  ...FORUM_POSTS.map(
    (id): Shot => ({
      name: `forum-post-${id}`,
      run: async (ctx) => {
        const { page } = ctx;
        await open(page, `/forum/${id}`);
        await forumShoot(ctx, `post-${id}`, "full");
        // The engine analysis panels, every one expanded (none on a post
        // with built positions only or with its analysis hidden).
        const toggles = page.getByRole("button", { name: "Show analysis" });
        const toggleCount = await toggles.count();
        if (toggleCount > 0) {
          for (let i = 0; i < toggleCount; i++) await toggles.first().click();
          await page.waitForTimeout(200);
          await forumShoot(ctx, `post-${id}-analysis`, "full");
          await open(page, `/forum/${id}`);
        }
        // The post's edit form (the first Edit is the post's own; write
        // mode and the author only).
        const edit = page.getByRole("button", { name: "Edit", exact: true }).first();
        if ((await edit.count()) > 0) {
          await edit.click();
          await page.waitForTimeout(200);
          await forumShoot(ctx, `post-${id}-edit`, "full");
          await open(page, `/forum/${id}`);
        }
        const tally = page.getByText(/^Show proposals/);
        if (await tally.count()) {
          console.log(`forum post ${id}: opening tally`);
          await tally.first().click();
          await page.waitForTimeout(200);
          await forumShoot(ctx, `post-${id}-tally-open`, "full");
          await open(page, `/forum/${id}`);
        }
        if (id === 5) {
          const checkerChip = page.getByRole("button", { name: /^Position 1/ }).first();
          if (await checkerChip.count()) {
            console.log(`forum post ${id}: focusing checker chip`);
            await checkerChip.focus();
            await forumShoot(ctx, `post-${id}-checker-chip-focus`, "viewport");
            await checkerChip.click();
            await page.getByRole("dialog").waitFor();
            await forumShoot(ctx, `post-${id}-checker-modal`, "viewport");
            await open(page, `/forum/${id}`);
          }
        }
        if (id === 5 || id === 7) {
          console.log(`forum post ${id}: opening proposal draft`);
          const propose = page.getByRole("button", { name: "Propose this move" }).first();
          await propose.click();
          await page.waitForTimeout(200);
          await forumShoot(ctx, `post-${id}-${id === 5 ? "checker" : "cube"}-draft-open`, "full");
        }
        if (id === 7) {
          const cubeAction = page.getByRole("button", { name: "No double", exact: true }).first();
          await cubeAction.click();
          await forumShoot(ctx, `post-${id}-cube-draft-selected`, "full");
        }
        // The interactive move explorer: one checker picked up, then moved.
        const source = page.locator('[aria-label^="Select checker on point"]').first();
        if ((await source.count()) === 0) return;
        await source.scrollIntoViewIfNeeded();
        // Keyboard, not a click: a mouse click on a source point already
        // plays a hop (pointer down picks up, pointer up drops), so it never
        // shows the picked-up state.
        await source.focus();
        await page.keyboard.press("Enter");
        await page.waitForTimeout(200);
        await forumShoot(ctx, `post-${id}-explorer-selected`, "viewport");
        const target = page.getByRole("button", { name: /^(Move from |Bear off from )/ }).first();
        if ((await target.count()) === 0) return;
        await target.click();
        await page.waitForTimeout(200);
        await forumShoot(ctx, `post-${id}-explorer-moved`, "viewport");
      },
    }),
  ),
  {
    name: "forum-text-post-flows",
    run: async (ctx) => {
      const { page } = ctx;
      await openReplay(page, REPLAY_CHECKER_ERROR);
      await forumActionShot(ctx, "replay-post-button", "viewport");
      await page.getByRole("button", { name: "Post to forum" }).click();
      await page.waitForURL("**/forum/new");
      await expect(page.getByRole("button", { name: "Remove board" })).toBeVisible();
      await forumShoot(ctx, "new-match-board", "full");
      await page.getByRole("button", { name: "Remove board" }).click();
      await forumShoot(ctx, "new-match-board-removed", "full");
      await page.reload();
      await forumShoot(ctx, "new-empty-after-reload", "full");

      await open(page, `/matches/${MATCH}`);
      await forumActionShot(ctx, "match-analysis-post-button");
      await open(page, "/mistakes?category=checker&severity=blunder");
      await forumActionShot(ctx, "mistakes-post-button");
      await open(page, "/repeated-positions?severity=blunder");
      const firstPosition = page.locator('a[href*="positionId="]').first();
      await firstPosition.click();
      await page.waitForURL(/positionId=/);
      await forumActionShot(ctx, "repeated-position-post-button");

      await open(page, "/position-builder");
      await forumActionShot(ctx, "builder-post-button");
      await page.getByRole("button", { name: "Post to forum" }).click();
      await page.waitForURL("**/forum/new");
      await expect(page.getByRole("button", { name: "Remove board" })).toBeVisible();
      await forumShoot(ctx, "new-builder-board", "full");

      await open(page, "/forum/new");
      await page.getByLabel("Title").fill("Draft title");
      await page.getByLabel("Body").fill("Draft body");
      await page.getByRole("link", { name: "Add a board from the position builder" }).click();
      await page.getByRole("button", { name: "Post to forum" }).click();
      await page.waitForURL("**/forum/new");
      await expect(page.getByLabel("Title")).toHaveValue("Draft title");
      await expect(page.getByLabel("Body")).toHaveValue("Draft body");
      await expect(page.getByRole("button", { name: "Remove board" })).toBeVisible();
      await forumShoot(ctx, "new-builder-draft-restored", "full");

      const created = await page.evaluate(async () => {
        const response = await fetch("/api/forum/posts", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ title: "Text-only forum post", body: "A post with no attached board.", positions: [] }),
        });
        return response.ok ? await response.json() as { id: number } : null;
      });
      if (created) {
        await open(page, "/forum");
        await open(page, `/forum/${created.id}`);
        await forumShoot(ctx, "text-only-post", "full");
        await open(page, "/forum");
        await forumShoot(ctx, "list-with-text-only-post", "full");
        await page.evaluate(async (id) => {
          await fetch(`/api/forum/posts/${id}`, { method: "DELETE" });
        }, created.id);
      }
    },
  },
  {
    name: "forum-new",
    run: async (ctx) => {
      await open(ctx.page, "/forum/new");
      await forumShoot(ctx, "new-empty", "full");
      if (FORUM_DECISION) {
        await open(ctx.page, `/forum/new?decision=${FORUM_DECISION}`);
        await forumShoot(ctx, `new-decision-${FORUM_DECISION}`, "full");
      }
    },
  },
  {
    name: "position-builder",
    run: async (ctx) => {
      await open(ctx.page, "/position-builder");
      await forumShoot(ctx, "position-builder", "full");
    },
  },
];
