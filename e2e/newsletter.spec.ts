import { expect, test } from "@playwright/test";
import { noSeriousA11yIssues, openNewsSearch } from "./helpers";

test("search the news by words and by outlet", async ({ page }) => {
  await page.goto("/");
  const search = page.getByRole("search");
  await openNewsSearch(page);
  await search.getByRole("searchbox", { name: "Procurar nas notícias" }).fill("código");
  await search.getByRole("button", { name: "Procurar", exact: true }).click();
  await expect(page).toHaveURL(/[?&]q=c%C3%B3digo/);
  await expect(page.getByText(/Com «código»/)).toBeVisible();
  await expect(page.getByRole("link", { name: /Título com código/ }).first()).toBeVisible();
  // Picking a paper keeps the words.
  await page.getByRole("button", { name: /^Jornais/ }).click();
  await page
    .getByRole("dialog", { name: "Escolher jornais" })
    .getByRole("checkbox", { name: /Observador/ })
    .check();
  await page
    .getByRole("dialog", { name: "Escolher jornais" })
    .getByRole("button", { name: /^Mostrar (\d+ )?notícias?$/ })
    .click();
  await expect(page).toHaveURL(/fonte=observador\.pt&q=/);
  await expect(page.getByText(/Com «código» · Observador/)).toBeVisible();
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

test("newsletter links open pages that act only on the button: confirm and unsubscribe", async ({ page }) => {
  let posts = 0;
  page.on("request", (request) => {
    if (request.method() === "POST" && /\/newsletter\/(confirm|unsubscribe)/.test(request.url())) posts++;
  });
  await page.goto("/newsletter/confirmar?token=boa-ligacao");
  const main = page.locator("main");
  await expect(main.getByRole("heading", { level: 1, name: "Confirma a tua inscrição na newsletter" })).toBeVisible();
  await noSeriousA11yIssues(page);
  expect(posts).toBe(0);
  await main.getByRole("button", { name: "Confirmar" }).click();
  await expect(main.getByRole("status")).toContainText("Inscrição confirmada. Obrigado!");
  expect(posts).toBe(1);

  await page.goto("/newsletter/confirmar?token=ligacao-expirado");
  await main.getByRole("button", { name: "Confirmar" }).click();
  await expect(main.getByRole("alert")).toContainText("Esta ligação já não é válida");
  // With the sign-up form, to try again.
  await expect(main.getByRole("button", { name: "Quero receber" })).toBeVisible();

  await page.goto("/newsletter/cancelar?token=boa-ligacao");
  await expect(main.getByRole("heading", { level: 1, name: "Queres deixar de receber a newsletter?" })).toBeVisible();
  await noSeriousA11yIssues(page);
  await main.getByRole("button", { name: "Cancelar inscrição" }).click();
  await expect(main.getByRole("status")).toContainText("Cancelaste a inscrição. Não vais receber mais emails.");

  await page.goto("/newsletter/cancelar?token=ligacao-expirado");
  await main.getByRole("button", { name: "Cancelar inscrição" }).click();
  await expect(main.getByRole("alert")).toContainText("Esta ligação já não é válida");
});
