import { expect, test, type Page } from "@playwright/test";
import { waitForHydration } from "./helpers";

/**
 * The pages a list page fetches in advance (Next's prefetch of each link in view), by path. One visit to a long list
 * must not fetch dozens of pages: bots crawl these lists all day.
 */
async function prefetchedPaths(page: Page, url: string): Promise<string[]> {
  const prefetched: string[] = [];
  page.on("request", (request) => {
    const headers = request.headers();
    if (headers["next-router-prefetch"] || headers["next-router-segment-prefetch"]) prefetched.push(new URL(request.url()).pathname);
  });
  await page.goto(url);
  await waitForHydration(page);
  await page.mouse.wheel(0, 4000);
  // Next prefetches links in view once the browser is idle.
  await page.waitForTimeout(1500);
  return prefetched;
}

for (const [url, item] of [
  ["/", /^\/article\//],
  ["/sitios", /^\/sitios\/./],
  ["/iniciativas", /^\/iniciativas\/\d/],
  ["/partidos", /^\/partido\//],
  ["/eleicoes", /^\/eleicoes\/./],
  ["/editorial", /^\/editorial\/./],
] as const) {
  test(`${url} does not fetch the pages it lists in advance`, async ({ page }) => {
    const paths = await prefetchedPaths(page, url);
    expect(paths.filter((path) => item.test(path))).toEqual([]);
  });
}
