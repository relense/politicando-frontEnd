import { expect, test, type Page } from "@playwright/test";
import { noSeriousA11yIssues } from "./helpers";

// The mock readers (mocks/accountFixtures.ts): fictional names, test-only passwords. The mock API keeps its state between
// the desktop and the mobile runs, so names that tests create carry the project's name.
const READER = { username: "leitora_de_teste", password: "palavra-passe-de-teste" };
const MOCK_API = "http://localhost:4100/api/v2";

const accountButton = (page: Page, username: string) => page.getByRole("button", { name: new RegExp(username) });

async function logIn(page: Page, who = READER, path = "/entrar") {
  await page.goto(path);
  await page.getByLabel("Nome", { exact: true }).fill(who.username);
  await page.getByLabel("Palavra-passe", { exact: true }).fill(who.password);
  await page.getByRole("checkbox", { name: /Não sou um robô/ }).check();
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(accountButton(page, who.username)).toBeVisible();
}

async function openAccountMenu(page: Page, username: string) {
  await accountButton(page, username).click();
  return page.getByRole("region", { name: "A tua conta" });
}

test("create an account, log out, log back in, change the password and delete it", async ({ page }, testInfo) => {
  const username = `conta_${testInfo.project.name}`;
  const password = "uma-frase-bem-comprida";
  await page.goto("/criar-conta?depois=%2Fguardadas");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await expect(page.getByRole("heading", { level: 1, name: "Cria a tua conta" })).toBeVisible();
  // A page of its own: no sections column and no footer.
  await expect(page.getByRole("navigation", { name: "Secções" })).toBeHidden();
  await expect(page.locator("footer[data-site-footer]")).toBeHidden();
  await noSeriousA11yIssues(page);

  // The rules first, next to each field.
  await page.getByLabel("Nome público").fill("ab");
  await page.getByLabel("Palavra-passe", { exact: true }).fill("curta");
  await page.getByRole("button", { name: "Criar conta", exact: true }).click();
  await expect(page.getByText("Entre 3 e 20 letras sem acentos")).toBeVisible();
  await expect(page.getByText("Pelo menos 8 caracteres.", { exact: true })).toBeVisible();
  await expect(page.getByText("Para criar a conta, aceita os termos.")).toBeVisible();

  // A taken name, in the API's words.
  await page.getByLabel("Nome público").fill(READER.username);
  await page.getByLabel("Palavra-passe", { exact: true }).fill(password);
  await expect(page.getByText(/^(Boa|Forte)\./)).toBeVisible();
  await page.getByRole("button", { name: "Mostrar a palavra-passe" }).click();
  await expect(page.getByLabel("Palavra-passe", { exact: true })).toHaveAttribute("type", "text");
  await page.getByRole("checkbox", { name: /Aceito os Termos/ }).check();
  await page.getByRole("checkbox", { name: /Não sou um robô/ }).check();
  await page.getByRole("button", { name: "Criar conta", exact: true }).click();
  await expect(page.getByText("Esse nome já está a ser usado. Escolhe outro.").first()).toBeVisible();

  await page.getByLabel("Nome público").fill(username);
  await page.getByRole("checkbox", { name: /Não sou um robô/ }).check();
  await page.getByRole("button", { name: "Criar conta", exact: true }).click();
  // Back where the reader came from, logged in.
  await expect(page).toHaveURL(/\/guardadas$/);
  const menu = await openAccountMenu(page, username);
  await expect(menu).toContainText("nome público nos comentários");
  await expect(menu.getByRole("link", { name: "Definições da conta" })).toBeVisible();
  await expect(menu.getByRole("group", { name: "Tema" })).toBeVisible();
  await noSeriousA11yIssues(page);
  await menu.getByRole("button", { name: "Terminar sessão" }).click();
  await expect(accountButton(page, username)).toHaveCount(0);
  await expect(page.getByRole("link", { name: testInfo.project.name === "mobile" ? "Entrar ou criar conta" : "Entrar" })).toBeVisible();

  // A wrong password says so without saying which part was wrong.
  await page.goto("/entrar");
  await page.getByLabel("Nome", { exact: true }).fill(username);
  await page.getByLabel("Palavra-passe", { exact: true }).fill("nao-e-esta");
  await page.getByRole("checkbox", { name: /Não sou um robô/ }).check();
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Nome ou palavra-passe errados." })).toBeVisible();
  await logIn(page, { username, password });

  // What they wrote, on a page of its own, from the account menu.
  const menu2 = await openAccountMenu(page, username);
  await menu2.getByRole("link", { name: "Os meus comentários" }).click();
  await expect(page).toHaveURL(/\/conta\/comentarios$/);
  await expect(page.getByRole("heading", { level: 1, name: "Os meus comentários" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Os meus comentários" })).toContainText("Um comentário de teste feito com conta.");
  await noSeriousA11yIssues(page);

  // The settings: password, data, delete.
  await page.goto("/conta");
  await expect(page.getByRole("heading", { level: 1, name: username })).toBeVisible();
  await expect(page.getByRole("list", { name: "Os meus comentários" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Descarregar os meus dados (JSON)" })).toHaveAttribute("href", "/api/v2/me/export");
  await noSeriousA11yIssues(page);

  await page.getByLabel("Palavra-passe atual").fill("errada-errada");
  await page.getByLabel("Nova palavra-passe", { exact: true }).fill("outra-frase-comprida");
  await page.getByLabel("Repete a nova palavra-passe").fill("outra-frase-comprida");
  await page.getByRole("button", { name: "Mudar a palavra-passe" }).click();
  await expect(page.getByText("A palavra-passe atual não está certa.")).toBeVisible();
  await page.getByLabel("Palavra-passe atual").fill(password);
  await page.getByRole("button", { name: "Mudar a palavra-passe" }).click();
  await expect(page.getByText("Palavra-passe mudada.")).toBeVisible();

  await page.getByLabel("A tua palavra-passe, para confirmar").fill("outra-frase-comprida");
  await page.getByRole("button", { name: "Apagar a conta", exact: true }).click();
  await page.getByRole("button", { name: "Apagar a conta de vez" }).click();
  await expect(page).toHaveURL(/\/\?conta=apagada$/);
  await expect(accountButton(page, username)).toHaveCount(0);
});

test("the account and this browser share their lists: merged on login, emptied on logout, back on the next login", async ({ page }) => {
  await page.goto("/");
  // Saved before logging in, in this browser only.
  await page.evaluate(() =>
    window.localStorage.setItem("reader-prefs", JSON.stringify({ saved: [98], hidden: [], mutedSources: [], mutedParties: [] })),
  );
  await logIn(page);
  const saved = () =>
    page.evaluate(() => (JSON.parse(window.localStorage.getItem("reader-prefs") ?? "{}") as { saved?: number[] }).saved ?? []);
  // The account already had 101; the browser's 98 joined it.
  await expect.poll(saved).toEqual(expect.arrayContaining([98, 101]));
  await page.goto("/guardadas");
  await expect(page.locator("main article").filter({ hasText: "Notícia de teste número 98" })).toBeVisible();

  const menu = await openAccountMenu(page, READER.username);
  await expect(menu.getByRole("link", { name: /Guardadas/ })).toContainText("guardadas");
  await menu.getByRole("button", { name: "Terminar sessão" }).click();
  // The next person on this computer starts clean.
  await expect.poll(saved).toEqual([]);

  await logIn(page);
  await expect.poll(saved).toEqual(expect.arrayContaining([98, 101]));
});

test("with an account, comments carry its name and need no captcha", async ({ page }) => {
  const unique = `Comentário com conta ${Date.now()}`;
  await logIn(page);
  await page.goto("/article/97");
  await page.getByRole("button", { name: "Junta-te à conversa…" }).click();
  const form = page.locator("main form").first();
  await expect(form).toContainText(`A publicar como ${READER.username}`);
  await expect(form.getByRole("textbox", { name: "Nome (opcional)" })).toHaveCount(0);
  await form.getByLabel("Comentário").fill(unique);
  await expect(form.getByRole("checkbox")).toHaveCount(0);
  await form.getByRole("button", { name: "Publicar" }).click();
  const comment = page.locator("main li, main article").filter({ hasText: unique }).last();
  await expect(comment).toBeVisible();
  await expect(comment).toContainText(READER.username);
});

test("when the API asks for an account, taking part offers to log in", async ({ page, request }) => {
  // With the site's own setting on, it asks before the API can (e2e/login-required.spec.ts).
  test.skip(Boolean(process.env.NEXT_PUBLIC_LOGIN_REQUIRED), "the site asks first");
  await request.post(`${MOCK_API}/__mock/login-required`, { data: { on: true } });
  try {
    await page.goto("/editorial");
    const row = page.locator("main article").filter({ hasText: "A maioria que não existe" });
    await row.getByRole("button", { name: /^Votar a favor de/ }).click();
    const ask = page.getByRole("dialog", { name: "Entra para participar" });
    await expect(ask).toBeVisible();
    await expect(ask.getByRole("link", { name: "Criar conta" })).toHaveAttribute("href", "/criar-conta?depois=%2Feditorial");
    // A note on desktop (×), a sheet on phones ("Agora não").
    await ask.getByRole("button", { name: /^(Fechar|Agora não)$/ }).click();
    await expect(ask).toHaveCount(0);
  } finally {
    await request.post(`${MOCK_API}/__mock/login-required`, { data: { on: false } });
  }
});

test("without an account, the theme is chosen at the bottom of the menu, and kept across reloads without a flash", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  const openMenu = () =>
    testInfo.project.name === "mobile" ? page.getByRole("button", { name: "Abrir menu" }).click() : Promise.resolve();
  await openMenu();
  const choice = page.getByRole("group", { name: "Tema" }).locator("visible=true");
  await expect(choice.getByRole("button", { name: "Sistema" })).toHaveAttribute("aria-pressed", "true");
  await choice.getByRole("button", { name: "Escuro" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);

  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      (window as unknown as { __firstClass: string }).__firstClass = document.documentElement.className;
    });
  });
  await page.reload();
  expect(await page.evaluate(() => (window as unknown as { __firstClass: string }).__firstClass)).toContain("dark");

  await openMenu();
  await expect(choice.getByRole("button", { name: "Escuro" })).toHaveAttribute("aria-pressed", "true");
  await choice.getByRole("button", { name: "Claro" }).click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
});
