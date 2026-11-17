import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

/**
 * Waits until React has taken over the page (hydrated): the page title, or the main area, carries React's own
 * properties. Before that, a press may be replayed later (twice pressed, a toggle ends closed) and parts can still move.
 */
export async function waitForHydration(page: Page) {
  await page.waitForFunction(() => {
    const element = document.querySelector("h1") ?? document.querySelector("main");
    return Boolean(element && Object.keys(element).some((key) => key.startsWith("__reactFiber")));
  });
}

export const noSeriousA11yIssues = async (page: Page) => {
  await waitForHydration(page);
  // Seats fade in; checked once they have settled, so contrast isn't measured mid-animation.
  await page.emulateMedia({ reducedMotion: "reduce" });
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.map((violation) => `${violation.id}: ${violation.nodes[0]?.html}`)).toEqual([]);
};

/** On a phone the news search is a button that opens the box; elsewhere the box is always there. Pressed once, when the page is ready. */
export async function openNewsSearch(page: Page) {
  const box = page.getByRole("search").getByRole("searchbox", { name: "Procurar nas notícias" });
  const toggle = page.getByRole("button", { name: "Procurar nas notícias" });
  await expect(box.or(toggle).first()).toBeVisible();
  if (await box.isVisible()) return;
  await waitForHydration(page);
  await toggle.click();
  await expect(box).toBeVisible();
}
