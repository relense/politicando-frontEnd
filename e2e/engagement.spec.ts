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
  // Under the card: the latest of the conversation, each side marked, the newsroom's updates, and a box to answer.
  const discussion = page
    .getByRole("region", { name: /Passa ou chumba\?|A discussão/ })
    .filter({ has: page.getByRole("list", { name: "Últimas mensagens" }) });
  await expect(discussion.getByText("Redação")).toBeVisible();
  await expect(discussion.getByText(/^Previu: (Passa|Chumba)$/).first()).toBeVisible();
  const quick = `Passa, a abstenção chega (${testInfo.project.name} ${Date.now()})`;
  await discussion.getByRole("textbox", { name: "Responder na discussão" }).fill(quick);
  await discussion.getByRole("button", { name: "Responder" }).click();
  await expect(discussion.getByRole("listitem").filter({ hasText: quick }).getByText("Previu: Passa")).toBeVisible();
  // The board, and the news about the proposal, newest first.
  // "ao vivo" when the vote is today (the mock's closes in about 2 hours, which may be tomorrow), "aberta" otherwise.
  await expect(page.getByRole("region", { name: /Quadro “Votações”/ })).toContainText(/ao vivo|aberta/);
  const news = page.getByRole("region", { name: "Notícias sobre esta proposta" });
  await expect(news.getByRole("listitem").first()).toBeVisible();
  await page
    .getByRole("link", { name: /^Ver a discussão desta votação/ })
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
  // The vote's own thread page: the pick under the opening post, each side filterable, the column beside it.
  await expect(page.getByText(/^A tua previsão: Passa\. Podes mudar até às/)).toBeVisible();
  await expect(page.getByText("Respondes como")).toBeVisible();
  await page.getByRole("group", { name: "Mostrar respostas de" }).getByRole("button", { name: "Chumba" }).click();
  await expect(page.getByRole("article").filter({ hasText: reply })).toHaveCount(0);
  await page.getByRole("group", { name: "Mostrar respostas de" }).getByRole("button", { name: "Todos" }).click();
  await expect(mine).toBeVisible();
  if (testInfo.project.name !== "mobile") {
    await expect(page.getByRole("region", { name: "Como está a conversa (por respostas)" })).toContainText(/Passa \d+/);
    await expect(page.getByRole("region", { name: "Regras de votações" })).toContainText("Números? Põe a fonte.");
    await expect(page.getByRole("region", { name: "Sobre esta votação" })).toContainText("Fecha em");
  }
  await noSeriousA11yIssues(page);
  // Readers don't open threads on this board.
  await page.goto("/forum/votacoes");
  await expect(page.getByText("Uma conversa por votação")).toBeVisible();
  await expect(page.getByRole("link", { name: "Nova discussão" })).toHaveCount(0);
  await expect(page.getByRole("form", { name: /Nova discussão/ })).toHaveCount(0);

  await page.goto("/previsoes");
  // Another vote comes up to the card.
  await page
    .getByRole("button", { name: /prever →/ })
    .first()
    .click();
  await expect(page.getByText("O que os outros leitores previram só aparece depois de escolheres.")).toBeVisible();
  // Few picks so far: the count, no percentages.
  await page
    .getByRole("group", { name: /^A tua previsão para/ })
    .getByRole("button", { name: /^Chumba/ })
    .click();
  await expect(page.getByText(/^Ainda há poucas previsões \(\d+\)\. Mostramos as percentagens a partir de 20\.$/)).toBeVisible();
  await expect(page.getByText(/És dos primeiros/)).toBeVisible();
  // Upcoming votes say when they open.
  await expect(page.getByRole("region", { name: "Votações desta semana" })).toContainText(/Abre /);

  const record = page.getByRole("region", { name: /O teu registo/ });
  await expect(record).toContainText("previsões certas");
  await expect(record).toContainText("Acertas mais em habitação (3 de 3) do que em economia (1 de 3).");
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
  await expect(box).toContainText("Resultado · Rejeitado");
  await expect(box.getByText(/^Os leitores: \d+% passa/)).toBeVisible();
  await expect(box.getByRole("group", { name: /^A tua previsão para/ }).getByRole("button", { name: /^Passa/ })).toBeDisabled();
  await expect(box).toContainText("Terminada");
  await expect(box.getByRole("link", { name: "Ver como acabou a discussão" })).toHaveAttribute("href", "/forum/votacoes/704");
  await noSeriousA11yIssues(page);

  // Open: the card to pick, with its countdown and conversation.
  await page.goto("/iniciativas/5000");
  const open = page.getByRole("region", { name: "Passa ou chumba?" });
  await expect(open.getByRole("group", { name: /^A tua previsão para/ })).toBeVisible();
  await expect(open.getByText(/^Fecha em/)).toBeVisible();
  await expect(open.getByRole("link", { name: /^Ver a discussão/ })).toHaveAttribute("href", "/forum/votacoes/700");
  await expect(open.getByRole("link", { name: "Ler a proposta em linguagem simples →" })).toHaveCount(0);

  // Scheduled, not open yet: when it opens.
  await page.goto("/iniciativas/4995");
  const soon = page.getByRole("region", { name: "Passa ou chumba?" });
  await expect(soon).toContainText("em breve");
  await expect(soon).toContainText("As previsões abrem 24 de novembro, às 15:00");

  // Without one, nothing.
  await page.goto("/iniciativas/4990");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("region", { name: "Passa ou chumba?" })).toHaveCount(0);
});

test("the right column shows a chevron until it's first scrolled, then never again", async ({ page, isMobile }) => {
  test.skip(isMobile, "The side column is for wide screens");
  await page.setViewportSize({ width: 1400, height: 700 });
  await page.goto("/");
  const side = page.getByRole("complementary", { name: "Ao lado das notícias" });
  const hint = side.locator("[data-scroll-hint]");
  await expect(hint).toHaveCount(1);
  await side
    .locator(".overflow-y-auto")
    .first()
    .evaluate((element) => element.scrollBy(0, 300));
  await expect(hint).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeAttached();
  await page.waitForTimeout(500);
  await expect(side.locator("[data-scroll-hint]")).toHaveCount(0);
});
