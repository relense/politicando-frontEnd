import { expect, test, type Page } from "@playwright/test";
import { gotoReady, signUp } from "./helpers";

// Umami's script isn't loaded in tests (no website id): a stand-in records what the site asks it to count.
async function recordEvents(page: Page) {
  await page.addInitScript(() => {
    const events: { name: string; data?: unknown }[] = [];
    (window as unknown as { __events: typeof events }).__events = events;
    (window as unknown as { umami: { track: (name: string, data?: unknown) => void } }).umami = {
      track: (name, data) => events.push({ name, data }),
    };
  });
}
const events = (page: Page) => page.evaluate(() => (window as unknown as { __events: { name: string; data?: unknown }[] }).__events);

test("a sign-up is counted once the account exists, without the name", async ({ page }) => {
  await recordEvents(page);
  const name = `u${Date.now().toString(36)}`;
  await page.goto("/criar-conta");
  await page.getByLabel("Nome público").fill(name);
  await page.getByLabel("Palavra-passe", { exact: true }).fill("uma-frase-bem-comprida");
  await page.getByRole("checkbox", { name: /Aceito os/ }).check();
  await page.getByRole("checkbox", { name: /Não sou um robô/ }).check();
  await expect.poll(() => events(page)).toEqual([]);
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect.poll(() => events(page)).toContainEqual({ name: "register", data: { email: false } });
  expect(JSON.stringify(await events(page))).not.toContain(name);
});

test("a comment is counted only when the API publishes it", async ({ page }, testInfo) => {
  await signUp(page);
  await recordEvents(page);
  await gotoReady(page, "/article/100");
  const section = page.getByRole("region", { name: /Comentários/ });
  await section.getByRole("button", { name: "Junta-te à conversa…" }).click();
  // Refused by the mock API (ERRO-SERVIDOR, mocks/handlers.ts): nothing counted.
  await section.getByRole("textbox", { name: "Comentário", exact: true }).fill("ERRO-SERVIDOR não publicar");
  await section.getByRole("button", { name: "Publicar" }).click();
  await expect(section.getByRole("alert")).toBeVisible();
  expect((await events(page)).filter((event) => event.name === "comment-sent")).toEqual([]);
  await section
    .getByRole("textbox", { name: "Comentário", exact: true })
    .fill(`Comentário contado (${testInfo.project.name} ${Date.now()})`);
  await section.getByRole("button", { name: "Publicar" }).click();
  await expect.poll(() => events(page)).toContainEqual({ name: "comment-sent", data: { where: "articles", reply: false } });
});

test("links out to an outlet carry the outlet's domain for Umami's click count", async ({ page }) => {
  await page.goto("/article/100");
  const out = page.getByRole("link", { name: /Ler o artigo completo em/ });
  await expect(out).toHaveAttribute("data-umami-event", "outlet-click");
  await expect(out).toHaveAttribute("data-umami-event-where", "article-page");
  await expect(out).toHaveAttribute("data-umami-event-domain", /\./);
});
