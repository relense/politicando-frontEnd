import { expect, test, type Page } from "@playwright/test";
import { noSeriousA11yIssues } from "./helpers";

// Fictional readers made for each run: the mock API keeps its state between the desktop and the mobile runs, and the
// inbox is seeded per reader on first look.
async function register(page: Page, username: string, back = "/") {
  await page.goto(`/criar-conta?depois=${encodeURIComponent(back)}`);
  await page.getByLabel("Nome público").fill(username);
  await page.getByLabel("Palavra-passe", { exact: true }).fill("uma-frase-bem-comprida");
  await page.getByRole("checkbox", { name: /Aceito os Termos/ }).check();
  await page.getByRole("checkbox", { name: /Não sou um robô/ }).check();
  await page.getByRole("button", { name: "Criar conta", exact: true }).click();
  await expect(page.getByRole("button", { name: new RegExp(username) })).toBeVisible();
  // Back on the page it came from, once it has finished loading (not its loading skeleton).
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
}

const unique = (testInfo: { project: { name: string } }, prefix: string) => `${prefix}_${testInfo.project.name}_${Date.now() % 100000}`;

test("notifications: the bell counts what's unread, the panel and the page show it by kind, and it can all be marked read", async ({
  page,
}, testInfo) => {
  await register(page, unique(testInfo, "aviso"));
  const bell = page.getByRole(testInfo.project.name === "mobile" ? "link" : "button", { name: "Notificações: 2 por ler" });
  await expect(bell).toBeVisible();

  if (testInfo.project.name !== "mobile") {
    await bell.click();
    const panel = page.getByRole("region", { name: "Notificações" });
    await expect(panel).toContainText("respondeu ao teu comentário");
    await expect(panel).toContainText("Discordo de ti, mas é um bom ponto.");
    await panel.getByRole("tab", { name: "Previsões" }).click();
    await expect(panel).toContainText("Acertaste");
    await expect(panel).not.toContainText("respondeu ao teu comentário");
    await noSeriousA11yIssues(page);
    await panel.getByRole("link", { name: "Ver todas →" }).click();
  } else {
    await bell.click();
  }

  await expect(page).toHaveURL(/\/conta\/notificacoes$/);
  await expect(page.getByRole("heading", { level: 1, name: "Notificações" })).toBeVisible();
  const list = page.getByRole("list", { name: "Notificações" });
  await expect(list).toContainText("3 novas respostas na conversa que segues");
  await expect(page.getByRole("link", { name: "Responder →" })).toHaveAttribute("href", "/article/100#comentario-1");
  await noSeriousA11yIssues(page);
  await page.getByRole("button", { name: "Marcar tudo como lido" }).first().click();
  await expect(page.getByRole("img", { name: "Por ler" })).toHaveCount(0);
  await expect(page.getByRole(testInfo.project.name === "mobile" ? "link" : "button", { name: "Notificações", exact: true })).toBeVisible();
});

test("Seguir and Guardar: asked for an account first; with one, kept after a reload and listed on the saved page", async ({
  page,
}, testInfo) => {
  await page.goto("/forum/geral/8");
  await page.getByRole("button", { name: /^Seguir conversa/ }).click();
  await expect(page.getByRole("dialog", { name: "Segue o que te interessa" })).toBeVisible();
  await page.keyboard.press("Escape");

  await register(page, unique(testInfo, "segue"), "/forum/geral/8");
  await expect(page).toHaveURL(/\/forum\/geral\/8$/);
  const followButton = page.getByRole("button", { name: /Seguir conversa|A seguir conversa/ });
  await followButton.click();
  await expect(followButton).toHaveAttribute("aria-pressed", "true");
  await expect(followButton).toContainText("A seguir conversa");
  const saveThread = page.getByRole("button", { name: /Guarda(r|do) esta discussão/ });
  await saveThread.click();
  await expect(saveThread).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(page.getByRole("button", { name: /A seguir conversa/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: /Guardado esta discussão/ })).toHaveAttribute("aria-pressed", "true");

  await page.goto("/guardadas");
  const threads = page.getByRole("region", { name: "Discussões no fórum" });
  await expect(threads).toContainText("O que acham do debate do orçamento?");
  await noSeriousA11yIssues(page);
  await threads.getByRole("button", { name: /Guardado esta discussão/ }).click();
  await expect(threads).toHaveCount(0);
});

test("Passa ou chumba: anyone sees the votes; picking needs an account, and only then shows how the others picked", async ({
  page,
}, testInfo) => {
  await page.goto("/previsoes");
  await expect(page.getByRole("heading", { level: 1, name: "Passa ou chumba?" })).toBeVisible();
  const choice = page.getByRole("group", { name: /^A tua previsão para/ });
  await expect(choice).toBeVisible();
  await expect(page.getByText("O que os outros leitores previram só aparece depois de escolheres.")).toBeVisible();
  await choice.getByRole("button", { name: /^Passa/ }).click();
  await expect(page.getByRole("dialog", { name: "Entra para prever" })).toBeVisible();
  await noSeriousA11yIssues(page);
  await page.keyboard.press("Escape");

  await register(page, unique(testInfo, "preve"), "/previsoes");
  await expect(page).toHaveURL(/\/previsoes$/);
  await page
    .getByRole("group", { name: /^A tua previsão para/ })
    .getByRole("button", { name: /^Passa/ })
    .click();
  await expect(page.getByRole("group", { name: /^A tua previsão para/ }).getByRole("button", { name: /^Passa/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByText(/^Os leitores: \d+% passa/)).toBeVisible();
  // Another vote comes up to the card.
  await page
    .getByRole("button", { name: /^Prever →/ })
    .first()
    .click();
  await expect(page.getByText("O que os outros leitores previram só aparece depois de escolheres.")).toBeVisible();

  const record = page.getByRole("region", { name: /O teu registo/ });
  await expect(record).toContainText("previsões certas");
  await noSeriousA11yIssues(page);

  // On the front page too.
  await page.goto("/");
  await expect(
    page
      .getByRole("group", { name: /^A tua previsão para/ })
      .locator("visible=true")
      .first(),
  ).toBeVisible();
});
