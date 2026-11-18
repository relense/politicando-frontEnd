import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { noSeriousA11yIssues } from "./helpers";

// Runs only with the setting on, e.g. NEXT_PUBLIC_LOGIN_REQUIRED=comments,forum,votes,reports npx playwright test
// e2e/login-required.spec.ts (every other test takes part anonymously, as the site does by default).
test.skip(!process.env.NEXT_PUBLIC_LOGIN_REQUIRED, "NEXT_PUBLIC_LOGIN_REQUIRED is not set");

// The mock reader (mocks/accountFixtures.ts): a fictional name and a test-only password.
const READER = { username: "leitora_de_teste", password: "palavra-passe-de-teste" };

/** On /entrar, wherever the reader came from. */
async function fillLogin(page: Page) {
  await page.getByLabel("Nome", { exact: true }).fill(READER.username);
  await page.getByLabel("Palavra-passe", { exact: true }).fill(READER.password);
  await page.getByRole("checkbox", { name: /Não sou um robô/ }).check();
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
}

test("without an account, the comment is written first, kept while logging in, and published on the way back", async ({
  page,
}, testInfo) => {
  const unique = `Comentário escrito antes de entrar (${testInfo.project.name}) ${Date.now()}`;
  await page.goto("/article/97");
  await page.getByRole("button", { name: "Junta-te à conversa…" }).click();
  const form = page.locator("main form").first();
  // No name, no captcha and no "Publicar": the bar says what's missing.
  await expect(form).toContainText("Falta só entrar.");
  await expect(form.getByRole("textbox", { name: "Nome (opcional)" })).toHaveCount(0);
  await expect(form.getByRole("button", { name: "Publicar", exact: true })).toHaveCount(0);
  await form.getByRole("button", { name: "Criar conta e publicar" }).click();
  await expect(form.getByRole("alert")).toContainText("Escreve o teu comentário primeiro.");

  await form.getByRole("textbox", { name: "Comentário" }).fill(unique);
  await expect(form).toContainText("Rascunho guardado neste dispositivo");
  await noSeriousA11yIssues(page);
  await form.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/entrar\?depois=%2Farticle%2F97$/);
  await fillLogin(page);

  await expect(page).toHaveURL(/\/article\/97$/);
  await expect(page.getByRole("status").filter({ hasText: "O teu comentário foi publicado." })).toBeVisible();
  await expect(page.getByText(unique, { exact: true })).toBeVisible();
});

test("without an account, \"Importa\" asks next to the button, and counts after logging in", async ({ page }) => {
  await page.goto("/editorial");
  const row = page.locator("main article").filter({ hasText: "A maioria que não existe" });
  const importa = row.getByRole("button", { name: /dizem que «A maioria que não existe» importa/ });
  await importa.click();
  const note = page.getByRole("dialog", { name: "Diz-nos que este artigo importa" });
  await expect(note).toBeVisible();
  await expect(note).toContainText("Depois de entrares, marcamos “Importa” por ti.");
  await expect(importa).toHaveAttribute("aria-pressed", "false");
  // The note itself (the page has a badge of its own to fix).
  const { violations } = await new AxeBuilder({ page }).include('[role="dialog"]').analyze();
  expect(violations.map((violation) => violation.id)).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(note).toHaveCount(0);

  await importa.click();
  await note.getByRole("link", { name: /Entrar$/ }).click();
  await expect(page).toHaveURL(/\/entrar\?depois=%2Feditorial$/);
  await fillLogin(page);
  await expect(page).toHaveURL(/\/editorial$/);
  await expect(page.getByRole("status").filter({ hasText: "Marcaste “Importa” neste artigo." })).toBeVisible();
  await expect(importa).toHaveAttribute("aria-pressed", "true");
});

test("without an account, the forum shows the way in instead of its forms; with one, the forms", async ({ page }) => {
  await page.goto("/forum/geral/8");
  await expect(page.getByText("Entra para responder")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Resposta" })).toHaveCount(0);
  await page
    .getByRole("article", { name: /Resposta 33/ })
    .getByRole("button", { name: "Responder" })
    .click();
  await expect(page.getByRole("dialog", { name: "Escreve no fórum" })).toBeVisible();

  await page.goto("/forum/geral");
  await expect(page.getByText("Entra para abrir uma discussão")).toBeVisible();

  await page.goto("/entrar?depois=%2Fforum%2Fgeral%2F8");
  await fillLogin(page);
  await expect(page.getByRole("textbox", { name: "Resposta" })).toBeVisible();
});
