import { expect, test } from "@playwright/test";
import { FEATURES } from "../lib/features";
import { gotoReady } from "./helpers";

test("an open feed offers «Há notícias novas» when newer news arrives, and loads it only when pressed", async ({ page }) => {
  test.skip(FEATURES.stories, "The articles feed; the stories feed works the same way.");
  await page.clock.install();
  // Hydrated, so the feed's timer is running before the clock moves on.
  await gotoReady(page, "/");
  const first = page.locator("main article").first();
  await expect(first).toBeVisible();
  const before = await first.textContent();

  // The next look at the feed, from the browser, finds a newer article than any on the page.
  await page.route(/\/api\/v2\/articles\?/, async (route) => {
    const response = await route.fetch();
    const body = (await response.json()) as { items: Record<string, unknown>[] };
    const newest = {
      ...body.items[0]!,
      id: 990001,
      title: "Notícia fresca de teste",
      publishedAt: new Date(Date.now() + 3_600_000).toISOString(),
    };
    await route.fulfill({ response, json: { ...body, items: [newest, ...body.items] } });
  });

  const button = page.getByRole("button", { name: "Há notícias novas" });
  await expect(button).toHaveCount(0);
  await page.clock.fastForward("05:01");
  await expect(button).toBeVisible();
  // Nothing moved under the reader.
  expect(await first.textContent()).toBe(before);

  await button.click();
  await expect(page.locator("main article").first()).toContainText("Notícia fresca de teste");
  await expect(button).toHaveCount(0);
});

test("no «Há notícias novas» in an order other than newest first", async ({ page }) => {
  test.skip(FEATURES.stories, "The articles feed; the stories feed works the same way.");
  await page.clock.install();
  let looked = false;
  await page.route(/\/api\/v2\/articles\?/, async (route) => {
    looked = true;
    await route.continue();
  });
  await gotoReady(page, "/?ordem=votadas&periodo=hoje");
  await expect(page.locator("main article").first()).toBeVisible();
  await page.clock.fastForward("05:01");
  await page.waitForTimeout(500);
  expect(looked).toBe(false);
  await expect(page.getByRole("button", { name: "Há notícias novas" })).toHaveCount(0);
});
