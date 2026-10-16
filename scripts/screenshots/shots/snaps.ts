import { open, settle, type Shot } from "../helpers";

// The snaps set (--set=snaps): /snap-poc's Orientation card in its two
// steps, on one photo that has a saved truth. Nothing is saved.
const PHOTO = "PXL_20260927_142233229.jpg";

export const SNAPS_SHOTS: Shot[] = [
  {
    name: "snaps",
    run: async ({ page, variant, shoot }) => {
      await open(page, "/snap-poc");
      await page.locator(`button[title="${PHOTO}"]`).click();
      await page.locator(`img[alt="${PHOTO}"]`).waitFor();
      await page.waitForFunction(
        (alt) => (document.querySelector(`img[alt="${alt}"]`) as HTMLImageElement | null)?.complete === true,
        PHOTO
      );
      await settle(page);
      // The work area (nav bar, photo, board) at the top of the viewport.
      const toWorkArea = () => page.getByRole("button", { name: "← Previous" }).evaluate((el) => el.scrollIntoView());

      // Step 1: Rotate, Swap colours, Mirror checkers; no pips, Save off.
      await shoot("snaps-step1", "full");
      await toWorkArea();
      await shoot("snaps-step1", "viewport");

      // Step 2: focus moves to the selected corner number, so its quadrant
      // is washed.
      await page.getByRole("button", { name: "Board looks right →" }).click();
      await settle(page);
      await shoot("snaps-step2-focused", "full");
      await toWorkArea();
      await shoot("snaps-step2-focused", "viewport");

      // Step 2 with nothing focused: just the H badge on the selected corner.
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
      await settle(page);
      await toWorkArea();
      await shoot("snaps-step2-plain", "viewport");

      // Hovering another corner number previews its quadrant (pointer only).
      if (variant.width !== 390) {
        // Full page: scrolling after the hover would end it.
        await page.getByRole("radio", { name: "2 · Top-right" }).hover();
        await settle(page);
        await shoot("snaps-step2-hover", "full");
        await page.mouse.move(0, 0);
      }

      // Analyzing for Light: the same game, the corner moves to Light's home;
      // Light drawn at the top shows the "turn the board" nudge.
      await page.getByRole("radio", { name: "Light" }).click();
      await settle(page);
      await shoot("snaps-step2-light", "full");
      await toWorkArea();
      await shoot("snaps-step2-light", "viewport");

      // Light's home board on top corner 2: the point numbers count from
      // Light's side (1 at the outer edge of corner 2).
      await page.getByRole("radio", { name: "2 · Top-right" }).click();
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
      await settle(page);
      await shoot("snaps-step2-light-corner2", "full");
      await toWorkArea();
      await shoot("snaps-step2-light-corner2", "viewport");
    },
  },
];
