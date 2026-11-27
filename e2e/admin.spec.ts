import { expect, test, type Page } from "@playwright/test";
import { noSeriousA11yIssues, signUp } from "./helpers";

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
  await signUp(page);
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

test("ideas: a status with the team's answer and expected date, a reply as Politicando, a duplicate, then undo", async ({ page }) => {
  await signIn(page, MODERATOR, "/admin/ideias");
  await expect(page.getByRole("heading", { level: 1, name: "Ideias" })).toBeVisible();
  // First the ideas nobody from the team has looked at.
  const fresh = page.getByRole("article", { name: "Exportar votações em CSV" });
  await expect(fresh).toBeVisible();
  await noSeriousA11yIssues(page);

  // Planned, with an answer and a date: on the idea, pinned, and on its timeline.
  await page.getByRole("group", { name: "Estado" }).getByRole("button", { name: "Em análise" }).click();
  const idea = page.getByRole("article", { name: "Comparar o programa eleitoral com o que cada partido votou" });
  await idea.getByLabel("Estado").selectOption("planned");
  await idea.getByLabel(/Previsto para/).fill("2026-12-15");
  await idea.getByLabel(/Resposta da equipa/).fill("Está nos planos, depois do Orçamento.");
  await idea.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Guardado: «Comparar o programa eleitoral com o que cada partido votou» está «Planeada».",
  );
  await page.goto("/feedback/ideias/503");
  await expect(page.getByRole("region", { name: /Resposta da equipa · fixada/ })).toContainText("Está nos planos, depois do Orçamento.");
  await expect(page.getByRole("list", { name: "Estado da ideia" })).toContainText("previsto 15-12");

  // Back as it was.
  await page.goto("/admin/ideias");
  await page.getByRole("group", { name: "Estado" }).getByRole("button", { name: "Planeada" }).click();
  await idea.getByLabel("Estado").selectOption("reviewing");
  await idea.getByLabel(/Previsto para/).fill("");
  await idea.getByLabel(/Resposta da equipa/).fill("");
  await idea.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByRole("status")).toContainText("está «Em análise»");

  // A reply signed Politicando, with the EQUIPA mark on the site.
  await page.getByRole("group", { name: "Estado" }).getByRole("button", { name: "Sem estado" }).click();
  await fresh.getByRole("button", { name: "Responder como Politicando" }).click();
  await fresh.getByRole("button", { name: "Publicar como Politicando" }).click();
  await expect(fresh.getByRole("alert")).toContainText("Escreve o comentário antes de o publicar.");
  const text = `Boa ideia: vamos ver se dá para juntar ao Orçamento (${Date.now()}).`;
  await fresh.getByRole("textbox", { name: "Comentário da equipa" }).fill(text);
  await fresh.getByRole("button", { name: "Publicar como Politicando" }).click();
  await expect(page.getByRole("status")).toContainText("Comentário publicado em «Exportar votações em CSV».");
  await page.goto("/feedback/ideias/510");
  const team = page.getByRole("article", { name: "Comentário de Politicando" }).filter({ hasText: text });
  await expect(team).toContainText("EQUIPA");

  // A duplicate needs another idea's number; then it points to the original.
  await page.goto("/admin/ideias");
  await fresh.getByLabel("Estado").selectOption("duplicate");
  await fresh.getByLabel("Duplicada da ideia n.º").fill("510");
  await fresh.getByRole("button", { name: "Guardar" }).click();
  await expect(fresh.getByRole("alert")).toContainText("Uma ideia não pode ser duplicada de si própria.");
  await fresh.getByLabel("Duplicada da ideia n.º").fill("999999");
  await fresh.getByRole("button", { name: "Guardar" }).click();
  await expect(fresh.getByRole("alert")).toContainText("Esse número não é de outra ideia visível");
  await fresh.getByLabel("Duplicada da ideia n.º").fill("501");
  await fresh.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByRole("status")).toContainText("está «Duplicada»");
  await page.goto("/feedback/ideias/510");
  await expect(page.getByText("Já foi sugerida:")).toBeVisible();

  // Back as it was.
  await page.goto("/admin/ideias");
  await page.getByRole("group", { name: "Estado" }).getByRole("button", { name: "Duplicada" }).click();
  await fresh.getByLabel("Estado").selectOption("");
  await fresh.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByRole("status")).toContainText("está sem estado");
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

test("feedback answered on the site: the private link shows the answer, and stops when the message is closed", async ({
  page,
}, testInfo) => {
  const text = `O botão de partilhar não faz nada (${testInfo.project.name} ${Date.now()}).`;
  await page.goto("/feedback/nova?tipo=falha");
  await page.getByRole("textbox", { name: "O que acontece?" }).fill(text);
  await page.getByLabel("Não sou um robô (teste)").check();
  await page.getByRole("button", { name: "Enviar feedback →" }).click();
  await expect(page.getByRole("status")).toContainText("Acompanha a resposta");
  await page.getByRole("link", { name: "Ver o estado da mensagem →" }).click();
  await expect(page).toHaveURL(/\/feedback\/acompanhar\/[\w-]+$/);
  const follow = page.url();
  await expect(page.getByRole("heading", { level: 1, name: "A tua mensagem" })).toBeVisible();
  await expect(page.getByText("Por responder.")).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await noSeriousA11yIssues(page);
  // Kept on this device, for later.
  await page.goto("/feedback/nova?tipo=erro");
  await expect(page.getByRole("region", { name: "As tuas mensagens" })).toContainText("Algo não funciona");

  // The team answers on the site: no email needed.
  await signIn(page, MODERATOR, "/admin/feedback");
  await page.getByRole("button").filter({ hasText: text }).click();
  const message = page.getByRole("article").filter({ hasText: text });
  await expect(message).toContainText("Enviada sem conta");
  await expect(message.getByRole("button", { name: "Responder por email" })).toHaveCount(0);
  await message.getByLabel("Resposta").fill("Obrigado! Já está corrigido.");
  await message.getByRole("button", { name: "Responder no site" }).click();
  await expect(message.getByRole("status").filter({ hasText: "Resposta publicada no site." })).toBeVisible();
  await page.goto(follow);
  await expect(page.getByRole("region", { name: /Resposta da equipa/ })).toContainText("Obrigado! Já está corrigido.");

  // Closed: the link stops working.
  await page.goto("/admin/feedback");
  await page.getByRole("group", { name: "Estado das mensagens" }).getByRole("button", { name: "Todas" }).click();
  await page.getByRole("button").filter({ hasText: text }).click();
  await message.getByRole("button", { name: "Fechar mensagem" }).click();
  await message.getByRole("button", { name: "Fechar e apagar o email" }).click();
  await expect(message).toContainText("Fechadas");
  await page.goto(follow);
  await expect(page.getByRole("heading", { level: 1, name: "Esta mensagem foi encerrada" })).toBeVisible();
});

test("feedback sent signed in: the team's answer on the site reaches the reader's inbox", async ({ page }, testInfo) => {
  await signUp(page);
  const text = `A página do Governo não carrega (${testInfo.project.name} ${Date.now()}).`;
  await page.goto("/feedback/nova?tipo=falha");
  await page.getByRole("textbox", { name: "O que acontece?" }).fill(text);
  await page.getByLabel("Não sou um robô (teste)").check();
  await page.getByRole("button", { name: "Enviar feedback →" }).click();
  await expect(page.getByRole("status")).toContainText("a resposta da equipa também chega aos teus avisos");

  await signIn(page, MODERATOR, "/admin/feedback");
  await page.getByRole("button").filter({ hasText: text }).click();
  const message = page.getByRole("article").filter({ hasText: text });
  await expect(message).toContainText("Enviada com sessão iniciada");
  await message.getByLabel("Resposta").fill("Já está a funcionar outra vez. Obrigado!");
  await message.getByRole("button", { name: "Responder no site" }).click();
  await expect(message.getByRole("status").filter({ hasText: "Resposta publicada no site." })).toBeVisible();

  await page.goto("/conta/notificacoes");
  const line = page.getByText("A equipa respondeu à tua mensagem").first();
  await expect(line).toBeVisible();
  await expect(page.getByText("Já está a funcionar outra vez. Obrigado!").first()).toBeVisible();
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

test("readers: only an admin sees them; the totals, a search, one reader's activity with links, a suspension and its undo", async ({
  page,
}, testInfo) => {
  await signIn(page, MODERATOR);
  await expect(page.getByRole("navigation", { name: "Secções da moderação" }).getByRole("link", { name: "Utilizadores" })).toHaveCount(0);
  await page.getByRole("button", { name: "Sair" }).click();

  await signIn(page, ADMIN, "/admin/utilizadores");
  await expect(page.getByRole("heading", { name: "Utilizadores", level: 1 })).toBeVisible();
  const totals = page.getByRole("list", { name: "Totais" });
  await expect(totals).toContainText("Contas");
  await expect(totals).toContainText("Suspensas1");
  const list = page.getByRole("list", { name: "Contas" });
  await expect(list.getByRole("listitem")).toHaveCount(50);
  await page.getByRole("button", { name: "Carregar mais" }).click();
  await expect(list.getByRole("listitem")).toHaveCount(60);
  await noSeriousA11yIssues(page);

  await page.getByLabel("Procurar", { exact: true }).fill("atenta");
  await page.getByRole("button", { name: "Procurar" }).click();
  await expect(list.getByRole("listitem")).toHaveCount(1);
  await list.getByRole("link", { name: "leitora_atenta" }).click();

  await expect(page.getByRole("heading", { name: "leitora_atenta", level: 1 })).toBeVisible();
  await expect(page.getByText("leitora.atenta@exemplo.pt")).toBeVisible();
  await expect(page.getByRole("link", { name: "/orcamento/2027/proposta/25391" })).toBeVisible();
  const timeline = page.getByRole("list", { name: "O que fez" });
  const comment = timeline.getByRole("listitem").filter({ hasText: "Comentou" });
  await expect(comment).toContainText("falta dizer de onde vem o dinheiro");
  await expect(comment.getByRole("link", { name: "Notícia de teste número 100" })).toHaveAttribute("href", "/article/100");
  await expect(timeline).toContainText("Votou a favor (▲)");
  // Opening the account is in the log, by name.
  await expect(page.getByRole("list", { name: "Registo" })).toContainText("Rita Fonseca abriu esta conta");
  await noSeriousA11yIssues(page);

  // Suspend until a day, with a reason; then lift it (the mock API keeps state between projects).
  await page.getByRole("button", { name: "Suspender…" }).click();
  await page.getByLabel("Até").fill("2026-12-31");
  await page.getByLabel("Motivo").fill(`Teste ${testInfo.project.name}`);
  await page.getByRole("button", { name: "Suspender", exact: true }).click();
  await expect(page.getByText("Suspensa até 31-12-2026").first()).toBeVisible();
  await expect(page.getByRole("list", { name: "Moderação" })).toContainText(`Teste ${testInfo.project.name}`);
  await page.getByRole("button", { name: "Levantar a suspensão…" }).click();
  await page.getByLabel("Motivo").fill("Engano no teste");
  await page.getByRole("button", { name: "Levantar a suspensão", exact: true }).click();
  await expect(page.getByText("Ativa", { exact: true }).first()).toBeVisible();
});
