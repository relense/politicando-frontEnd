import { expect, test } from "@playwright/test";
import { noSeriousA11yIssues } from "./helpers";

test("contracts page: counter, procedures, rankings, search and more", async ({ page }) => {
  await page.goto("/contratos");
  await expect(page.getByRole("heading", { level: 1, name: "Contratos públicos" })).toBeVisible();
  const counter = page.getByRole("region", { name: /Ajustes diretos desde/ });
  await expect(counter).toContainText("contratos sem concorrência aberta");
  await expect(page.getByRole("list", { name: "Procedimentos" }).getByRole("listitem")).toHaveCount(6);
  await expect(page.getByText(/Lisboa e Porto aparecem à frente/)).toBeVisible();

  // Ajustes diretos by default, 20 per page, then more.
  const list = page.getByRole("list", { name: "Contratos", exact: true });
  await expect(list.getByRole("listitem")).toHaveCount(16);
  await expect(page.getByRole("button", { name: "Mostrar mais" })).toHaveCount(0);

  // Hostile text in a contract's object is shown as text.
  await page.getByRole("combobox", { name: "Procedimento" }).selectOption("todos");
  await page.getByRole("button", { name: "Procurar" }).click();
  await expect(page).toHaveURL(/tipo=todos/);
  await expect(list.getByRole("listitem")).toHaveCount(20);
  await expect(page.getByRole("link", { name: "<b>Aquisição</b> de serviços de limpeza" })).toBeVisible();
  await page.getByRole("button", { name: "Mostrar mais" }).click();
  await expect(page.getByRole("list", { name: "Mais contratos" }).getByRole("listitem")).toHaveCount(10);
  await expect(page.getByText("Não há mais contratos com estes filtros.")).toBeVisible();

  await page.getByLabel("O que foi comprado").fill("software");
  await page.getByRole("button", { name: "Procurar" }).click();
  await expect(list.getByRole("listitem")).toHaveCount(6);
  await expect(list).not.toContainText("ESCOLARES");
  await noSeriousA11yIssues(page);
});

test("contracts in one place, from the municipality ranking", async ({ page }) => {
  await page.goto("/contratos");
  await page.getByRole("link", { name: "Sintra" }).first().click();
  await expect(page).toHaveURL(/local=LOCAL-111100/);
  await expect(page.getByRole("heading", { level: 1, name: "Contratos públicos em Sintra" })).toBeVisible();
  await expect(page.getByRole("link", { name: "ver o país todo" })).toBeVisible();
});

test("a contract and the body that awarded it", async ({ page }) => {
  await page.goto("/contratos?tipo=todos");
  await page.getByRole("link", { name: "<b>Aquisição</b> de serviços de limpeza" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("<b>Aquisição</b> de serviços de limpeza");
  await expect(page.getByRole("heading", { name: "O que é um ajuste direto?" })).toBeVisible();
  await expect(page.getByText("Urgência imperiosa (exemplo fictício)")).toBeVisible();
  await expect(page.getByRole("link", { name: "Águeda" })).toHaveAttribute("href", "/sitios/LOCAL-010100");
  await expect(page.getByRole("link", { name: /Ver no Portal BASE/ })).toHaveAttribute("href", /base\.gov\.pt/);
  await noSeriousA11yIssues(page);

  await page.getByRole("link", { name: "Município de Vale Formoso" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Município de Vale Formoso" })).toBeVisible();
  await expect(page.getByText("NIF 600000001")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Como entidade pública" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Como fornecedor" })).toHaveCount(0);
  await noSeriousA11yIssues(page);

  await page.getByRole("link", { name: "Ver todos os contratos que adjudicou" }).click();
  await expect(page).toHaveURL(/entidade=600000001/);
  await expect(page.getByRole("list", { name: "Contratos", exact: true }).getByRole("listitem")).toHaveCount(10);
});

test("a supplier without a NIF is not linked, and unknown contracts and NIFs are 404s", async ({ page }) => {
  await page.goto("/contratos?tipo=todos");
  await expect(page.getByText("Joana Exemplo").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Joana Exemplo" })).toHaveCount(0);

  for (const path of ["/contratos/999", "/contratos/abc", "/contratos/entidade/123456789", "/contratos/entidade/abc"]) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(404);
  }
});
