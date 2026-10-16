import { open, type Shot } from "../helpers";

export const BUILDER_SHOTS: Shot[] = [
  {
    name: "builder-checker-result",
    run: async ({ page, shoot }) => {
      await open(page, "/position-builder");
      await page.getByRole("button", { name: "Analyse with GNU" }).click();
      await page.getByText(/No legal moves|single survivor|[+-]\d\.\d{3}/).first().waitFor({ timeout: 120_000 });
      await shoot("builder-checker-result", "full");
    },
  },
  {
    name: "builder-cube-result",
    run: async ({ page, shoot }) => {
      await open(page, "/position-builder");
      await page.getByRole("button", { name: "Cube decision" }).click();
      await page.getByRole("button", { name: "Analyse with GNU" }).click();
      await page.getByText(/No double|Double/).first().waitFor({ timeout: 120_000 });
      await shoot("builder-cube-result", "full");
    },
  },
  {
    name: "builder-crawford-on",
    run: async ({ page, shoot }) => {
      await open(page, "/position-builder");
      await page.getByLabel("Bottom", { exact: true }).last().fill("6");
      await page.getByLabel("Crawford game").check();
      // The checked state is the subject of this shot; avoid capturing the
      // pointer-induced focus ring while preserving the app's keyboard ring.
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
      await shoot("builder-crawford-on", "full");
    },
  },
  {
    name: "builder-missing-dice",
    run: async ({ page, shoot }) => {
      await open(page, "/position-builder");
      await page.getByRole("button", { name: "Clear dice" }).click();
      await page.getByText("Set both dice for the checker decision.").waitFor();
      await shoot("builder-missing-dice", "full");
    },
  },
];
