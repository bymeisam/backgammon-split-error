import { expect, test } from "@playwright/test";

test("forum post draft survives the position builder round trip", async ({ page }) => {
  await page.goto("/forum/new");
  await page.getByLabel("Title").fill("Draft title");
  await page.getByLabel("Body").fill("Draft body");

  await page.getByRole("link", { name: "Add a board from the position builder" }).click();
  await expect(page).toHaveURL(/\/position-builder/);
  await page.getByRole("button", { name: "Post to forum" }).click();

  await expect(page).toHaveURL(/\/forum\/new$/);
  await expect(page.getByLabel("Title")).toHaveValue("Draft title");
  await expect(page.getByLabel("Body")).toHaveValue("Draft body");
  await expect(page.getByRole("button", { name: "Remove board" })).toBeVisible();
});
