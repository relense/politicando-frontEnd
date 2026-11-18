import { expect, test, type Page } from "@playwright/test";
import { noSeriousA11yIssues } from "./helpers";

// The mock team (mocks/adminState.ts): fictional people, test-only passwords.
const ADMIN = { email: "admin@exemplo.pt", password: "palavra-passe-de-teste" };
const MODERATOR = { email: "moderador@exemplo.pt", password: "palavra-passe-de-teste" };
const AUTHOR = { email: "autora@exemplo.pt", password: "palavra-passe-de-teste" };

// The mock API keeps its state between the desktop and the mobile runs: every test undoes what it changes.

async function signIn(page: Page, who = ADMIN, path = "/admin") {
  await page.goto(path);
  await page.getByLabel("Email").fill(who.email);
  await page.getByLabel("Palavra-passe").fill(who.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("button", { name: "Sair" })).toBeVisible();
}

test("the moderation area asks to sign in, refuses a wrong password, and is kept out of search", async ({ page }) => {
  await page.goto("/admin");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await expect(page.getByRole("heading", { level: 1, name: "Moderação" })).toBeVisible();
  await noSeriousA11yIssues(page);
  await page.getByLabel("Email").fill(ADMIN.email);
  await page.getByLabel("Palavra-passe").fill("errada-errada-errada");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Email ou palavra-passe errados." })).toBeVisible();

  await page.getByLabel("Palavra-passe").fill(ADMIN.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Denúncias" })).toBeVisible();
  // The session survives a reload (an httpOnly cookie, through the site's own server).
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Denúncias" })).toBeVisible();
  await noSeriousA11yIssues(page);
  await page.getByRole("button", { name: "Sair" }).click();
  await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
});

test("a reported thread can be hidden from the queue and shown again from the forum section", async ({ page }) => {
  // A reader reports it.
  await page.goto("/forum/ps/10");
  const op = page.locator("#op");
  await op.getByRole("button", { name: "Denunciar" }).click();
  await op.getByLabel("Dados pessoais").check();
  await op.getByRole("button", { name: "Enviar denúncia" }).click();
  await expect(op.getByRole("status")).toContainText("Obrigado, vamos rever");

  await signIn(page);
  const report = page.getByRole("list", { name: "Denúncias" }).getByRole("article").filter({ hasText: "Propostas para a habitação" });
  await expect(report).toContainText("Dados pessoais");
  await report.getByRole("button", { name: "Esconder" }).click();
  await expect(report).toHaveCount(0);

  // Gone from the site…
  const response = await page.request.get("/forum/ps/10");
  expect(response.status()).toBe(404);

  // …and listed as hidden, to undo it.
  await page.getByRole("navigation", { name: "Secções da moderação" }).getByRole("link", { name: "Fórum" }).click();
  const hidden = page.getByRole("list", { name: "Escondidos recentemente" }).getByRole("listitem").filter({ hasText: "Discussão #10" });
  await hidden.getByRole("button", { name: "Mostrar outra vez" }).click();
  await expect(hidden).toHaveCount(0);
  expect((await page.request.get("/forum/ps/10")).status()).toBe(200);
});

test("forum: pin and lock a thread, hide a reply, then undo", async ({ page }) => {
  await signIn(page, ADMIN, "/admin/forum");
  await noSeriousA11yIssues(page);
  await page.getByLabel("Quadro").selectOption("ps");
  const thread = page.getByRole("list", { name: "Discussões" }).getByRole("article").filter({ hasText: "Propostas para a habitação" });
  await thread.getByRole("button", { name: "Fixar" }).click();
  await expect(thread.getByText("Fixada")).toBeVisible();
  await thread.getByRole("button", { name: "Desafixar" }).click();
  await expect(thread.getByText("Fixada")).toHaveCount(0);
  await thread.getByRole("button", { name: "Fechar", exact: true }).click();
  await expect(thread.getByText("Fechada")).toBeVisible();
  await thread.getByRole("button", { name: "Reabrir" }).click();
  await expect(thread.getByText("Fechada")).toHaveCount(0);

  await page.getByLabel("Quadro").selectOption("geral");
  const budget = page
    .getByRole("list", { name: "Discussões" })
    .getByRole("article")
    .filter({ hasText: "O que acham do debate do orçamento?" });
  await budget.getByRole("button", { name: "Ver respostas" }).click();
  const reply = budget.getByRole("list", { name: "Respostas" }).getByRole("listitem").filter({ hasText: "No.31" });
  await expect(reply).toContainText("Concordo, as contas são confusas.");
  await reply.getByRole("button", { name: "Esconder" }).click();
  await expect(reply).toContainText("escondida");
  await reply.getByRole("button", { name: "Mostrar outra vez" }).click();
  await expect(reply).toContainText("Concordo, as contas são confusas.");
});

test("comments: hide one with a reason, find it among the hidden, show it again", async ({ page }) => {
  await signIn(page, MODERATOR, "/admin/comentarios");
  const comment = page.getByRole("list", { name: "Comentários" }).getByRole("article").filter({ hasText: "Outro comentário principal." });
  await comment.getByRole("button", { name: "Esconder…" }).click();
  await comment.getByLabel("Motivo (opcional)").fill("Teste");
  await comment.getByRole("button", { name: "Esconder", exact: true }).click();
  await expect(comment).toHaveCount(0);
  await noSeriousA11yIssues(page);

  await page.getByRole("group", { name: "Que comentários" }).getByRole("button", { name: "Escondidos" }).click();
  const hidden = page.getByRole("list", { name: "Comentários" }).getByRole("article").filter({ hasText: "Outro comentário principal." });
  await expect(hidden.getByText("Escondido", { exact: true })).toBeVisible();
  await hidden.getByRole("button", { name: "Mostrar outra vez" }).click();
  await expect(hidden).toHaveCount(0);
});

test("feedback: read a message with its screenshot, keep a note, mark it answered and log a correction", async ({ page }, testInfo) => {
  await signIn(page, ADMIN, "/admin/feedback");
  await page.getByRole("group", { name: "Estado das mensagens" }).getByRole("button", { name: "Todas" }).click();
  await page.getByRole("button", { name: /partido errado na página dos deputados/ }).click();
  const message = page.getByRole("article", { name: "Mensagem #41" });
  await expect(message.getByRole("img", { name: "Captura de ecrã enviada com a mensagem" })).toBeVisible();
  await expect(message.getByText("É do partido Exemplo desde 2025.")).toBeVisible();
  await noSeriousA11yIssues(page);

  await message.getByLabel("Nota interna").fill(`Visto no teste (${testInfo.project.name})`);
  await message.getByRole("button", { name: "Guardar nota" }).click();
  await expect(message.getByRole("status").filter({ hasText: "Guardada." })).toBeVisible();

  await message.getByRole("button", { name: "Marcar como respondida" }).click();
  await expect(message.getByRole("status").filter({ hasText: "Marcada como respondida." })).toBeVisible();
  await expect(message).toContainText("Respondidas");

  const title = `Partido de um deputado corrigido (${testInfo.project.name})`;
  await message.getByLabel("O que foi corrigido").fill(title);
  await message.getByRole("button", { name: "Registar correção" }).click();
  await expect(message.getByRole("listitem").filter({ hasText: title })).toBeVisible();

  // Closing asks twice; cancelling leaves it as it was.
  await page.getByRole("button", { name: /O mapa das eleições não abre/ }).click();
  const other = page.getByRole("article", { name: "Mensagem #40" });
  await expect(other).toContainText("anónimo, sem email");
  await other.getByRole("button", { name: "Fechar mensagem" }).click();
  await other.getByRole("button", { name: "Cancelar" }).click();
  await expect(other.getByRole("button", { name: "Fechar mensagem" })).toBeVisible();
});

test("team: only an admin sees it, and can invite someone", async ({ page }, testInfo) => {
  await signIn(page, MODERATOR);
  await expect(page.getByRole("navigation", { name: "Secções da moderação" }).getByRole("link", { name: "Equipa" })).toHaveCount(0);
  await page.goto("/admin/equipa");
  await expect(page.getByText("não dá acesso a esta secção")).toBeVisible();

  await page.getByRole("button", { name: "Sair" }).click();
  await signIn(page, ADMIN, "/admin/equipa");
  const team = page.getByRole("list", { name: "Equipa" });
  await expect(team.getByRole("listitem").filter({ hasText: "Rita Fonseca" })).toContainText("(tu)");
  await noSeriousA11yIssues(page);
  const name = `Convidado de teste ${testInfo.project.name}`;
  await page.getByLabel("Nome").fill(name);
  await page.getByLabel("Email").fill(`convidado-${testInfo.project.name}-${Date.now()}@exemplo.pt`);
  await page.getByLabel("Primeira palavra-passe").fill("uma-palavra-passe-longa");
  await page.getByRole("button", { name: "Convidar" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Convite criado" })).toBeVisible();
  await expect(team.getByRole("listitem").filter({ hasText: name })).toBeVisible();
});

test("account: the password form checks the new one and the current one", async ({ page }) => {
  await signIn(page, MODERATOR, "/admin/conta");
  await page.getByLabel("Palavra-passe atual").fill("nao-e-esta-palavra");
  await page.getByLabel("Nova palavra-passe").fill("curta");
  await page.getByLabel("Repete a nova").fill("curta");
  await page.getByRole("button", { name: "Mudar palavra-passe" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "pelo menos 12 caracteres" })).toBeVisible();
  await page.getByLabel("Nova palavra-passe").fill("uma-palavra-passe-nova");
  await page.getByLabel("Repete a nova").fill("uma-palavra-passe-nova");
  await page.getByRole("button", { name: "Mudar palavra-passe" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Email ou palavra-passe errados." })).toBeVisible();
  await noSeriousA11yIssues(page);
});

test("blog: an author writes a draft, previews it, publishes it, then takes it back and deletes it", async ({ page }, testInfo) => {
  const title = `Um guia de teste para ${testInfo.project.name}`;
  await signIn(page, AUTHOR, "/admin");
  // Authors don't moderate: the reports queue sends them to their posts.
  await page.getByRole("link", { name: "Ir para Artigos" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Artigos do blog" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Secções da moderação" }).getByRole("link")).toHaveText(["Artigos", "A minha conta"]);
  await noSeriousA11yIssues(page);

  await page.getByRole("link", { name: "Novo artigo" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Novo artigo" })).toBeVisible();
  // The editor checks the API's rules first, next to each field.
  await page.getByLabel("Título", { exact: true }).fill("Um");
  await page.getByLabel("Imagem de capa").fill("http://exemplo.pt/capa.jpg");
  await page.getByRole("button", { name: "Guardar rascunho" }).click();
  await expect(page.getByText("O título precisa de pelo menos 3 letras.")).toBeVisible();
  await expect(page.getByText("Tem de ser um link https://.")).toBeVisible();
  await expect(page.getByLabel("Título", { exact: true })).toHaveAttribute("aria-invalid", "true");

  await page.getByLabel("Título", { exact: true }).fill(title);
  await page.getByLabel("Imagem de capa").fill("");
  await page.getByLabel("Etiquetas").fill("Parlamento, guias");
  await page.getByRole("textbox", { name: "Texto" }).fill("## O essencial\n\nUm texto com **negrito** e <b>html</b> que fica como texto.");
  await page.getByRole("button", { name: "Pré-visualizar" }).click();
  const preview = page.getByRole("region", { name: "Pré-visualização" });
  await expect(preview.getByRole("heading", { name: "O essencial" })).toBeVisible();
  await expect(preview.locator("strong")).toHaveText("negrito");
  await expect(preview).toContainText("<b>html</b>");
  await expect(preview).toContainText("Inês Carvalho");
  await noSeriousA11yIssues(page);

  await page.getByRole("button", { name: "Guardar rascunho" }).click();
  await expect(page).toHaveURL(/\/admin\/artigos\/\d+$/);
  await expect(page.getByRole("heading", { level: 1, name: "Editar artigo" })).toBeVisible();
  // The API's tidy version: tags in lower case.
  await expect(page.getByLabel("Etiquetas")).toHaveValue("parlamento, guias");
  const slug = await page.getByLabel("Endereço").inputValue();
  expect(slug).toMatch(/^um-guia-de-teste-para-/);

  await page.getByRole("button", { name: "Publicar" }).click();
  await expect(page.getByText("Publicado. Pode demorar até um minuto a aparecer no site.")).toBeVisible();
  // Authors don't choose the front page.
  await expect(page.getByRole("button", { name: "Pôr em destaque" })).toHaveCount(0);
  await page.goto(`/editorial/${slug}`);
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();

  await page.goto("/admin/artigos");
  const row = page.getByRole("list", { name: "Artigos" }).getByRole("listitem").filter({ hasText: title });
  await expect(row).toContainText("Publicado");
  await row.getByRole("link", { name: `Editar ${title}` }).click();
  await page.getByRole("button", { name: "Despublicar" }).click();
  await expect(page.getByText("Voltou a rascunho: já não aparece no site.")).toBeVisible();
  await page.getByRole("button", { name: "Apagar rascunho" }).click();
  await page.getByRole("button", { name: "Apagar de vez" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Artigos do blog" })).toBeVisible();
  await expect(page.getByText(title)).toHaveCount(0);
});

test("blog: unsaved writing survives a reload, and a moderator can feature any post", async ({ page }) => {
  await signIn(page, MODERATOR, "/admin/artigos");
  const row = page.getByRole("list", { name: "Artigos" }).getByRole("listitem").filter({ hasText: "Como se faz uma lei" });
  await row.getByRole("link", { name: "Editar Como se faz uma lei" }).click();
  await expect(page.getByLabel("Título", { exact: true })).toHaveValue("Como se faz uma lei");

  await page.getByLabel("Subtítulo").fill("Uma frase ainda por guardar.");
  await expect(page.getByText("Alterações por guardar.")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Subtítulo")).toHaveValue("Da proposta à promulgação, passo a passo.");
  await page.getByRole("button", { name: "Recuperar" }).click();
  await expect(page.getByLabel("Subtítulo")).toHaveValue("Uma frase ainda por guardar.");
  await page.getByLabel("Subtítulo").fill("Da proposta à promulgação, passo a passo.");
  await expect(page.getByText("Alterações por guardar.")).toHaveCount(0);

  await page.getByRole("button", { name: "Pôr em destaque" }).click();
  await expect(page.getByText("Em destaque na página inicial.")).toBeVisible();
  await page.getByRole("button", { name: "Tirar do destaque" }).click();
  await expect(page.getByText("Saiu dos destaques.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Pôr em destaque" })).toBeVisible();
});
