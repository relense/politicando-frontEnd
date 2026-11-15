import { expect, test } from "@playwright/test";
import { noSeriousA11yIssues } from "./helpers";

test("become a deputy: the rules, the seats per círculo, d'Hondt and the real lists", async ({ page }) => {
  await page.goto("/como-ser-deputado");
  await expect(page.getByRole("heading", { level: 1, name: "Como se chega a deputado" })).toBeVisible();

  const contents = page.getByRole("navigation", { name: "Nesta página" });
  await contents.getByRole("link", { name: "O método de Hondt" }).click();
  await expect(page).toHaveURL(/#dhondt$/);

  // Portalegre by default: two seats, and the closest miss.
  const table = page.getByRole("table", { name: /Método de Hondt em Portalegre/ });
  await expect(table).toBeVisible();
  await expect(table.getByRole("rowheader", { name: /AD/ })).toContainText("faltaram 501 votos para mais um deputado");
  await expect(page.getByText("Texto revisto a")).toBeVisible();

  // The PS list: one elected above the line, one who entered later from below it.
  const ps = page.getByRole("list", { name: "Lista PS" });
  await expect(ps).toContainText("eleito");
  await expect(ps).toContainText("entrou por substituição");
  await expect(page.getByText("entrou por substituição.").first()).toBeVisible();

  // Switching to Lisboa changes the table and the lists.
  await page.getByRole("link", { name: "Lisboa (grande)" }).click();
  await expect(page).toHaveURL(/circulo=LOCAL-110000/);
  await expect(page.getByRole("table", { name: /Método de Hondt em Lisboa/ })).toBeVisible();
  await expect(page.getByText("Mostram-se só as primeiras divisões.")).toBeVisible();

  // And back with the picker.
  await page.getByRole("combobox", { name: "Círculo" }).selectOption("LOCAL-120000");
  await page.getByRole("button", { name: "Ver" }).click();
  await expect(page).toHaveURL(/circulo=LOCAL-120000/);
  await expect(page.getByRole("table", { name: /Método de Hondt em Portalegre/ })).toBeVisible();

  // The featured people come from the people mock: the President has their own page, the PM theirs.
  await expect(page.getByRole("link", { name: /Teresa Albuquerque/ })).toHaveAttribute("href", "/presidente");
  await expect(page.getByRole("link", { name: /Henrique Valadares/ }).first()).toHaveAttribute("href", /\/governo\/0+1/);
  await noSeriousA11yIssues(page);
});

test("become a deputy: an unknown círculo falls back to Portalegre", async ({ page }) => {
  await page.goto("/como-ser-deputado?circulo=nada");
  await expect(page.getByRole("table", { name: /Método de Hondt em Portalegre/ })).toBeVisible();
});

test("become a deputy is accessible in dark mode", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/como-ser-deputado?circulo=LOCAL-110000");
  await noSeriousA11yIssues(page);
});

test("election results compare with the previous election of the same type", async ({ page }) => {
  await page.goto("/eleicoes/legislativas-2025/LOCAL-110000");
  const results = page.getByRole("region", { name: /Resultados por lista/ });
  await expect(results.getByRole("columnheader", { name: "vs 2024" })).toBeVisible();
  await expect(results.getByRole("row", { name: /Partido Socialista/ })).toContainText(/[−+]\d+,\d pp/);
  await expect(results.getByRole("link", { name: "Legislativas 2024" })).toHaveAttribute(
    "href",
    "/eleicoes/legislativas-2024/LOCAL-110000",
  );
  await expect(page.getByText(/pp vs 2024/)).toBeVisible();
  await noSeriousA11yIssues(page);

  // The first election has nothing before it.
  await page.goto("/eleicoes/legislativas-2024/LOCAL-110000");
  await expect(page.getByRole("columnheader", { name: /^vs / })).toHaveCount(0);
});
