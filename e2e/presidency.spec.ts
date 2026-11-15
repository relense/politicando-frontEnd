import { expect, test } from "@playwright/test";
import { noSeriousA11yIssues } from "./helpers";

test("president page: profile, the laws in this term, the explainer and former Presidents", async ({ page }) => {
  await page.goto("/presidente");
  await expect(page.getByRole("heading", { level: 1, name: "Teresa Albuquerque" })).toBeVisible();
  await expect(page).toHaveTitle(/Teresa Albuquerque, Presidente da República/);
  await expect(page.getByText("promulgadas", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Na secretária do Presidente/ })).toBeVisible();
  const desk = page.getByRole("region", { name: /Na secretária do Presidente/ });
  await expect(desk.getByText("No Tribunal Constitucional").first()).toBeVisible();
  await expect(desk.getByText(/prazo para decidir fica suspenso/).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "O que faz o Presidente da República" })).toBeVisible();
  await expect(page.getByText("Jorge Vilalobos")).toBeVisible();

  const ld = await page.locator('script[type="application/ld+json"]').textContent();
  expect(JSON.parse(ld!)).toMatchObject({ "@type": "Person", name: "Teresa Albuquerque" });

  await page.getByText("Ler a biografia completa").click();
  await expect(page.getByText(/Foi eleita Presidente da República/)).toBeVisible();

  const vetoes = page.getByRole("region", { name: "Vetos" });
  await vetoes.getByRole("link", { name: "Ver todos os vetos" }).click();
  await expect(page).toHaveURL(/\/iniciativas\?presidente=vetoed$/);
  await expect(page.locator("a:visible", { hasText: /^Vetada/ }).first()).toHaveAttribute("aria-current", "page");
});

test("initiatives: plain titles, topic and status filters, more on demand, and the detail page", async ({ page }) => {
  await page.goto("/iniciativas");
  await expect(page.getByRole("heading", { level: 1, name: "O que está a mudar nas leis" })).toBeVisible();
  const list = page.getByRole("list", { name: "Iniciativas" });
  await expect(list.getByRole("article")).toHaveCount(20);
  await expect(list.getByText("não muda nenhuma lei").first()).toBeVisible();
  await page.getByRole("button", { name: "Carregar mais 20" }).click();
  await expect(list.getByRole("article")).toHaveCount(40);

  await page
    .getByRole("navigation", { name: "Temas" })
    .getByRole("link", { name: /^Saúde/ })
    .click();
  await expect(page).toHaveURL(/tema=saude/);
  await expect(list.getByRole("article").first()).toBeVisible();
  for (const article of await list.getByRole("article").all())
    await expect(article.getByRole("link", { name: "Saúde", exact: true })).toBeVisible();

  // The phases: pills above the list on phones, "o caminho de uma lei" beside it on larger screens.
  await page
    .locator("a:visible", { hasText: /^Aprovada no Parlamento/ })
    .first()
    .click();
  await expect(page).toHaveURL(/tema=saude&estado=approved/);
  await expect(page.getByRole("link", { name: /Tema: Saúde/ })).toBeVisible();

  await list.getByRole("heading").first().getByRole("link").click();
  await expect(page).toHaveURL(/\/iniciativas\/\d+$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText("Título oficial:")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Como votaram os partidos" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Ler o texto oficial/ })).toHaveAttribute("href", /^https:/);
  await expect(page.getByRole("link", { name: "Discutir no fórum" })).toHaveAttribute("href", /\/forum\/geral\?iniciativa=\d+#nova/);
});

test("initiatives: search the titles and change the order, keeping the topic", async ({ page }) => {
  await page.goto("/iniciativas?tema=saude");
  const list = page.getByRole("list", { name: "Iniciativas" });
  const firstLink = list.getByRole("heading").first().getByRole("link");
  const first = await firstLink.textContent();
  const newest = await firstLink.getAttribute("href");
  await page.getByRole("link", { name: "Mais antigas" }).click();
  await expect(page).toHaveURL(/tema=saude&ordem=antigas/);
  await expect(page.getByText("mais antigas primeiro")).toBeVisible();
  await expect(list.getByRole("heading").first().getByRole("link")).not.toHaveAttribute("href", newest!);

  const words = (first ?? "").split(/\s+/).find((word) => /^\p{L}{7,}$/u.test(word))!;
  await page.getByRole("searchbox", { name: "Procurar iniciativas" }).fill(words);
  await page.getByRole("button", { name: "Procurar" }).click();
  await expect(page).toHaveURL(new RegExp(`tema=saude&ordem=antigas&q=`));
  await expect(page.getByRole("link", { name: new RegExp(`Pesquisa: «${words}»`) })).toBeVisible();
  for (const heading of await list.getByRole("heading").all()) await expect(heading).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});

test("initiative detail: unknown id is a 404, and list cards link to the detail page", async ({ page }) => {
  const missing = await page.goto("/iniciativas/123");
  expect(missing?.status()).toBe(404);

  await page.goto("/iniciativas/5000");
  await expect(page.getByRole("heading", { name: "No Presidente da República" })).toBeVisible();

  await page.goto("/iniciativas");
  await page.getByRole("list", { name: "Iniciativas" }).getByRole("listitem").first().getByRole("heading").getByRole("link").click();
  await expect(page).toHaveURL(/\/iniciativas\/\d+$/);
});

for (const colorScheme of ["light", "dark"] as const) {
  for (const path of ["/presidente", "/iniciativas", "/iniciativas?tema=saude", "/iniciativas/5000"]) {
    test(`no accessibility violations: ${path} (${colorScheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      await page.goto(path);
      await expect(page.locator("main")).toBeVisible();
      await noSeriousA11yIssues(page);
      expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
    });
  }
}
