import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const noSeriousA11yIssues = async (page: import("@playwright/test").Page) => {
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.map((violation) => `${violation.id}: ${violation.nodes[0]?.html}`)).toEqual([]);
};

test("feed loads more on scroll and reaches the end", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("article")).toHaveCount(10);
  for (let i = 0; i < 6 && !(await page.getByText("Não há mais notícias.").isVisible()); i++) {
    await page.mouse.wheel(0, 100_000);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(300);
  }
  await expect(page.getByText("Não há mais notícias.")).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(35);
});

test("hostile title stays harmless text", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: /<script>window.__xss/ })).toBeVisible();
  expect(await page.evaluate(() => "__xss" in window)).toBe(false);
});

test("direct party URL works, and unknown party is a real 404", async ({ page }) => {
  await page.goto("/partido/cds-pp");
  await expect(page.getByRole("heading", { level: 1, name: "CDS-PP" })).toBeVisible();
  await expect(page.getByRole("article").first()).toContainText("CDS-PP");

  const response = await page.goto("/partido/nao-existe");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Página não encontrada" })).toBeVisible();
});

test("old party URLs redirect to the current slug", async ({ page }) => {
  await page.goto("/partido/l");
  await expect(page).toHaveURL(/\/partido\/livre$/);
  await page.goto("/partido/pctp");
  await expect(page).toHaveURL(/\/partido\/pctp-mrpp$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("PCTP/MRPP");
});

test("missing and malformed articles are real 404s", async ({ request }) => {
  expect((await request.get("/article/99999")).status()).toBe(404);
  expect((await request.get("/article/abc")).status()).toBe(404);
  expect((await request.get("/article/99999999999")).status()).toBe(404);
});

test("home scrolling still loads the home feed after visiting a party", async ({ page }) => {
  await page.goto("/partido/be");
  await page.getByRole("link", { name: "POLITICANDO" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Últimas notícias" })).toBeVisible();
  await expect(page.getByRole("article").first()).toContainText("número 100");
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(page.getByRole("article").nth(10)).toContainText("número 90");
});

test("back navigation shows the right article", async ({ page }) => {
  await page.goto("/article/100");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("número 100");
  await page.goto("/article/98");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("número 98");
  await page.goBack();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("número 100");
});

test("post a comment and a reply; API errors are shown", async ({ page }) => {
  const unique = `Comentário ${Date.now()}`;
  await page.goto("/article/97");
  const form = page.locator("main form").first();

  await form.getByRole("button", { name: "Publicar" }).click();
  await expect(form.getByRole("alert")).toContainText("Escreve um comentário");

  await form.getByLabel("Comentário").fill("ERRO-SERVIDOR");
  await form.getByRole("checkbox").check();
  await form.getByRole("button", { name: "Publicar" }).click();
  await expect(form.getByRole("alert")).toContainText("Não foi possível publicar");
  await expect(form.getByLabel("Comentário")).toHaveValue("ERRO-SERVIDOR");

  await form.getByLabel("Comentário").fill(unique);
  await form.getByRole("checkbox").check();
  await form.getByRole("button", { name: "Publicar" }).click();
  await expect(page.getByText(unique, { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "responder" }).last().click();
  await page.getByRole("textbox", { name: "Resposta" }).fill(`Resposta a ${unique}`);
  await page.locator("main form").last().getByRole("checkbox").check();
  await page.locator("main form").last().getByRole("button", { name: "Publicar" }).click();
  await expect(page.locator("p", { hasText: `Resposta a ${unique}` })).toBeVisible();

  await page.reload();
  await expect(page.getByText(unique, { exact: true })).toBeVisible();
});

test("theme persists across reload without a flash", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await page.getByRole("button", { name: /tema/ }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      (window as unknown as { __firstClass: string }).__firstClass = document.documentElement.className;
    });
  });
  await page.reload();
  expect(await page.evaluate(() => (window as unknown as { __firstClass: string }).__firstClass)).toContain("dark");
});

test("drawer works by keyboard", async ({ page }) => {
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "Abrir lista de partidos" });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const drawer = page.getByRole("dialog", { name: "Partidos" });
  await expect(drawer).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
  await expect(trigger).toBeFocused();

  await page.keyboard.press("Enter");
  await drawer.getByRole("link", { name: /PSD/ }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/partido\/psd$/);
  await expect(drawer).toBeHidden();
});

test("article HTML carries SEO data without JavaScript", async ({ request }) => {
  const html = await (await request.get("/article/100")).text();
  expect(html).toContain("<title>Notícia de teste número 100");
  expect(html).toContain('property="og:title"');
  expect(html).toContain('"@type":"NewsArticle"');
  expect(html).toContain('lang="pt-PT"');
  expect(html).toContain('rel="canonical"');
  expect(html).toContain("Este é o texto de exemplo");
});

test("article page shows the excerpt and links to the original", async ({ page }) => {
  await page.goto("/article/100");
  const link = page.getByRole("link", { name: /Ler o artigo completo em Público/ });
  await expect(link).toHaveAttribute("href", "https://example.com/noticia/100");
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(page.locator("article p").first()).toContainText("…");
});

test("article without an excerpt still renders", async ({ page }) => {
  await page.goto("/article/99");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Título com código");
  await expect(page.getByRole("link", { name: /Ler o artigo completo/ })).toBeVisible();
});

test("hostile title cannot break out of JSON-LD", async ({ request }) => {
  const html = await (await request.get("/article/99")).text();
  expect(html).not.toContain("<script>window.__xss");
});

test("sitemap and robots are served", async ({ request }) => {
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("/article/100");
  expect(sitemap).toContain("/partido/cds-pp");
  expect(await (await request.get("/robots.txt")).text()).toContain("Sitemap:");
});

for (const colorScheme of ["light", "dark"] as const) {
  for (const path of ["/", "/partido/ps", "/article/100"]) {
    test(`no accessibility violations: ${path} (${colorScheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      await page.goto(path);
      await expect(page.locator("main")).toBeVisible();
      await noSeriousA11yIssues(page);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      expect(overflow).toBe(false);
    });
  }
}
