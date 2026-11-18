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
  // Once the page knows there's no session (before that, the API answers and the general note opens).
  const checked = page.waitForResponse((response) => /\/api\/v2\/me$/.test(response.url()));
  await page.goto("/previsoes");
  await checked;
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
  // The vote's thread: the reader's pick shows beside their name, as the others' do.
  await expect(page.getByText(/^Fecha em/).first()).toBeVisible();
  await page
    .getByRole("link", { name: /^Defende a tua escolha/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/forum\/votacoes\/\d+$/);
  await expect(page.getByText("✕ Chumba").first()).toBeVisible();
  // Picking followed the thread.
  await expect(page.getByRole("button", { name: /A seguir conversa/ })).toHaveAttribute("aria-pressed", "true");
  const reply = `Defendo que passa (${testInfo.project.name} ${Date.now()})`;
  await page.getByRole("textbox", { name: "Resposta" }).fill(reply);
  await page.getByRole("button", { name: "Publicar" }).click();
  const mine = page.getByRole("article").filter({ hasText: reply });
  await expect(mine.getByText("✓ Passa")).toBeVisible();
  await noSeriousA11yIssues(page);
  // Readers don't open threads on this board.
  await page.goto("/forum/votacoes");
  await expect(page.getByText("Uma conversa por votação")).toBeVisible();
  await expect(page.getByRole("link", { name: "Nova discussão" })).toHaveCount(0);
  await expect(page.getByRole("form", { name: /Nova discussão/ })).toHaveCount(0);

  await page.goto("/previsoes");
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

test("an initiative shows its Passa ou chumba beside it: the card while open; once decided, the result, how readers picked and the conversation", async ({
  page,
}) => {
  // Decided: the readers' split is for everyone now.
  await page.goto("/iniciativas/4996");
  const box = page.getByRole("region", { name: "Passa ou chumba?" });
  await expect(box).toContainText("Resultado: Rejeitado");
  await expect(box).toContainText("O que os leitores previram");
  await expect(box.getByText(/^Os leitores: \d+% passa/)).toBeVisible();
  await expect(box.getByRole("link", { name: "Ver a discussão da votação →" })).toHaveAttribute("href", "/forum/votacoes/704");
  await noSeriousA11yIssues(page);

  // Open: the card to pick, with its countdown and conversation.
  await page.goto("/iniciativas/5000");
  const open = page.getByRole("region", { name: "Passa ou chumba?" });
  await expect(open.getByRole("group", { name: /^A tua previsão para/ })).toBeVisible();
  await expect(open.getByText(/^Fecha em/)).toBeVisible();
  await expect(open.getByRole("link", { name: /^Defende a tua escolha/ })).toHaveAttribute("href", "/forum/votacoes/700");

  // Without one, nothing.
  await page.goto("/iniciativas/4990");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("region", { name: "Passa ou chumba?" })).toHaveCount(0);
});
