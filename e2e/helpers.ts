import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

export const noSeriousA11yIssues = async (page: Page) => {
  // Seats fade in; checked once they have settled, so contrast isn't measured mid-animation.
  await page.emulateMedia({ reducedMotion: "reduce" });
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.map((violation) => `${violation.id}: ${violation.nodes[0]?.html}`)).toEqual([]);
};
