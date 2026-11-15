import { expect, test } from "@playwright/test";
import { noSeriousA11yIssues } from "./helpers";

test("a deputy's page shows their career path and their record, with the presumption of innocence", async ({ page }) => {
  await page.goto("/registo/1");
  const deputyLink = page.locator("main a[href^='/deputados/']").first();
  await expect(deputyLink).toBeVisible();
  await deputyLink.click();
  await expect(page).toHaveURL(/\/deputados\/\d+/);

  const percurso = page.locator("#percurso");
  await expect(percurso.getByRole("heading", { name: "Percurso" })).toBeVisible();
  await expect(percurso.getByText("XVI legislatura (2024–2025)")).toBeVisible();
  await expect(percurso.getByText("Eleito na Assembleia Municipal")).toBeVisible();

  const record = page.getByRole("region", { name: "Registo" });
  await expect(record.getByRole("link", { name: "Operação Exemplo" })).toBeVisible();
  await expect(record.getByText("(Presume-se inocente)")).toBeVisible();
  await record.getByRole("link", { name: /Interesses declarados \(1\)/ }).click();
  await expect(page).toHaveURL(/\/interesses\?deputado=\d+/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Interesses declarados por");
  await expect(page.getByText(/ganhou 2 contratos públicos/)).toBeVisible();
});

test("a deputy without records has no record box", async ({ page }) => {
  await page.goto("/deputados/1100");
  await expect(page.getByRole("heading", { name: "Percurso" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Registo" })).toHaveCount(0);
});

test("a Government member's page shows their path", async ({ page }) => {
  await page.goto("/governo/00000000000000000000000000000001");
  const percurso = page.locator("#percurso");
  await expect(percurso.getByText("Primeiro-Ministro").first()).toBeVisible();
  await expect(percurso.getByText("atual", { exact: true })).toBeVisible();
});

test("featured paths link to each person's page", async ({ page }) => {
  await page.goto("/percursos");
  await expect(page.getByRole("heading", { level: 1, name: "Como chegaram lá" })).toBeVisible();
  await expect(
    page
      .getByRole("listitem")
      .filter({ hasText: "Presidente da República" })
      .getByRole("link", { name: /Ver percurso completo/ }),
  ).toHaveAttribute("href", "/presidente");
  await page.getByRole("link", { name: "Henrique Valadares", exact: true }).click();
  await expect(page).toHaveURL(/\/governo\/0+1/);
});

test("the record explains the stages and keeps the mandatory notes", async ({ page }) => {
  await page.goto("/registo");
  await expect(page.getByRole("heading", { name: "Como funciona um processo" })).toBeVisible();
  const card = page.getByRole("article").filter({ hasText: "Operação Exemplo" });
  await expect(card.getByText("(Presume-se inocente)")).toBeVisible();
  await expect(card.getByText("(Decisão não transitada em julgado)")).toBeVisible();
  await expect(card.getByText("Revisto a 15 nov. 2026")).toBeVisible();
  await card.getByText("o que significa?").click();
  await expect(card.getByText("O tribunal decidiu, mas ainda pode haver recurso.")).toBeVisible();

  await page.getByLabel("Fase").selectOption("investigation");
  await page.getByRole("button", { name: "Filtrar" }).click();
  await expect(page).toHaveURL(/fase=investigation/);
  await expect(page.getByText("Nenhum processo com estes filtros.")).toBeVisible();
});

test("a case page lists sources with court ones first, and offers corrections", async ({ page }) => {
  await page.goto("/registo/1");
  await expect(page.getByRole("heading", { level: 1, name: "Operação Exemplo" })).toBeVisible();
  const sources = page.locator("[id^='fonte-']");
  await expect(sources.first()).toContainText("Tribunal");
  await expect(sources.first()).toContainText("Acórdão");
  await expect(page.getByText("3 anos de prisão, suspensa")).toBeVisible();
  await expect(page.getByRole("link", { name: "Pedir correção" })).toHaveAttribute("href", /^mailto:/);
  await expect(page.getByText(/Presume-se inocente|presumem inocentes/).first()).toBeVisible();
});

test("unknown cases are a 404", async ({ page }) => {
  const response = await page.goto("/registo/999");
  expect(response?.status()).toBe(404);
});

for (const path of [
  "/percursos",
  "/registo",
  "/registo/1",
  "/interesses",
  "/deputados/1100",
  "/governo/00000000000000000000000000000001",
]) {
  test(`no serious accessibility issues on ${path}`, async ({ page }) => {
    await page.goto(path);
    await noSeriousA11yIssues(page);
  });
}
