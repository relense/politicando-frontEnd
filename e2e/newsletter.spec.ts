import { expect, test } from "@playwright/test";
import { noSeriousA11yIssues } from "./helpers";

test("search the news by words and by outlet", async ({ page }) => {
  await page.goto("/");
  const search = page.getByRole("search");
  await search.getByRole("searchbox", { name: "Procurar nas notícias" }).fill("código");
  await search.getByRole("button", { name: "Procurar", exact: true }).click();
  await expect(page).toHaveURL(/[?&]q=c%C3%B3digo/);
  await expect(page.getByText("Notícias com «código»")).toBeVisible();
  await expect(page.getByRole("link", { name: /Título com código/ }).first()).toBeVisible();
  // Picking a paper keeps the words.
  await page.getByRole("button", { name: /^Jornais/ }).click();
  await page
    .getByRole("dialog", { name: "Escolher jornais" })
    .getByRole("checkbox", { name: /Observador/ })
    .check();
  await page.getByRole("dialog", { name: "Escolher jornais" }).getByRole("button", { name: "Mostrar notícias" }).click();
  await expect(page).toHaveURL(/fonte=observador\.pt&q=/);
  await expect(page.getByText("Notícias com «código» · Observador")).toBeVisible();
  await noSeriousA11yIssues(page);
  // Emptying the words keeps the paper.
  await search.getByRole("searchbox", { name: "Procurar nas notícias" }).fill("");
  await search.getByRole("button", { name: "Procurar", exact: true }).click();
  await expect(page).toHaveURL(/\/\?fonte=observador\.pt$/);
  // Nothing found is said in words.
  await page.goto("/?q=zzzzzz");
  await expect(page.getByText("Nenhuma notícia encontrada.", { exact: false })).toBeVisible();
});

test("newsletter: sign up, and the pages the email links land on", async ({ page }) => {
  await page.goto("/newsletter");
  await expect(page.getByRole("heading", { level: 1, name: "A newsletter" })).toBeVisible();
  const email = page.getByRole("textbox", { name: "Email" });
  await email.fill("nao-e-email");
  await page.getByRole("button", { name: "Quero receber" }).click();
  await expect(page.getByText("Esse endereço de email não parece válido.")).toBeVisible();
  await email.fill("leitor@exemplo.pt");
  await page.getByLabel("Não sou um robô (teste)").check();
  await page.getByRole("button", { name: "Quero receber" }).click();
  await expect(page.getByRole("status")).toContainText("Verifica o teu email.");

  await page.goto("/newsletter?estado=confirmado");
  await expect(page.getByRole("heading", { name: "Inscrição confirmada. Obrigado!" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Quero receber" })).toHaveCount(0);
  await page.goto("/newsletter?estado=invalido");
  await expect(page.getByRole("heading", { name: "Esta ligação já não é válida." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Quero receber" })).toBeVisible();
  await noSeriousA11yIssues(page);
});
