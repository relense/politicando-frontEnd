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

let readers = 0;
/**
 * A fresh fictional reader for this test, signed in: taking part needs an account. Made through the API (the mock's
 * test captcha), so the test starts where it means to.
 */
export async function signUp(page: Page): Promise<string> {
  const username = `t${Date.now().toString(36)}${(readers++).toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
  const answer = await page.request.post("/api/v2/auth/register", {
    data: { username, password: "uma-frase-bem-comprida", recaptchaToken: "captcha-disabled", acceptTerms: true },
  });
  expect(answer.ok(), await answer.text()).toBe(true);
  return username;
}

/** The newest link the mock API "emailed" to an address: its token (mocks/accountFixtures.ts). */
export async function lastEmailToken(page: Page, to: string): Promise<string> {
  const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v2";
  const answer = await page.request.get(`${api}/__mock/last-email?to=${encodeURIComponent(to)}`);
  expect(answer.ok(), await answer.text()).toBe(true);
  return ((await answer.json()) as { token: string }).token;
}

/**
 * Opens a page and waits until it can be used: hydrated, the reader known and their account's lists applied
 * (components/account/AccountRuntime). A click before that can be lost or redrawn on a slow machine (CI).
 */
export async function gotoReady(page: Page, url: string) {
  await page.goto(url);
  await page.locator('html[data-account="ready"]').waitFor({ state: "attached" });
}
