import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

export const noSeriousA11yIssues = async (page: Page) => {
  // Seats fade in; checked once they have settled, so contrast isn't measured mid-animation.
  await page.emulateMedia({ reducedMotion: "reduce" });
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.map((violation) => `${violation.id}: ${violation.nodes[0]?.html}`)).toEqual([]);
};

/**
 * On a phone the news search is a button that opens the box; elsewhere the box is always there. On a slow machine the
 * button can be pressed before the page is interactive, which does nothing: pressed again until the box opens.
 */
export async function openNewsSearch(page: Page) {
  const box = page.getByRole("search").getByRole("searchbox", { name: "Procurar nas notícias" });
  const toggle = page.getByRole("button", { name: "Procurar nas notícias" });
  if (!(await toggle.isVisible())) return;
  await expect(async () => {
    if (!(await box.isVisible())) await toggle.click();
    await expect(box).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
}
