import { expect, test } from "@playwright/test";
import { gotoReady, noSeriousA11yIssues, signUp } from "./helpers";

test("State Budget: the current one, today's votes, each party, the filters and a proposal opened in place and on its page", async ({
  page,
  isMobile,
}) => {
  await gotoReady(page, "/orcamento");
  await expect(page.getByRole("heading", { level: 1, name: "Orçamento do Estado 2027" })).toBeVisible();
  // Nothing wider than the screen (20 Nov: a long topic in the menu pushed the page sideways on phones).
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  // A one-letter acronym says the name.
  await expect(page.getByRole("navigation", { name: "Proposta por" }).getByRole("link", { name: "LIVRE", exact: true })).toBeVisible();
  await expect(page.getByText("Em especialidade", { exact: true })).toBeVisible();
  // The final overall vote's day, ahead of time, once the agenda shows its session.
  await expect(page.getByText(/^Votação final global marcada para \d\d-\d\d-\d{4}, às \d\dh\d\d$/)).toBeVisible();
  // The running tally first: 5 of the 9 fictional proposals voted, 3 still to vote, and the withdrawn one named so it adds up.
  const tally = page.getByRole("region", { name: /propostas de alteração já votadas/ });
  await expect(tally).toContainText("de 9");
  await expect(tally).toContainText("1 retirada");
  // Its own share image, not the site's.
  const ogImage = await page.locator('meta[property="og:image"]').first().getAttribute("content");
  expect(ogImage).toContain("/orcamento/opengraph-image");
  const image = await page.request.get(ogImage!);
  expect(image.headers()["content-type"]).toContain("image/png");
  // The Budget's own vote on the general principles.
  const general = page.getByRole("region", { name: "Votação na generalidade" });
  await expect(general).toContainText("PSD");
  // Today's votes, and each party's line.
  await expect(page.getByRole("region", { name: /^Votações de hoje/ })).toContainText("Artigo 9.º do Código do IRS");
  await expect(page.getByRole("region", { name: "Como está a votar cada partido" })).toContainText("PCP");

  // «Por votar»: pending and sent to the plenary together.
  const proposals = page.getByRole("list", { name: "Propostas de alteração" });
  await page.getByRole("link", { name: /^Por votar/ }).click();
  await expect(page).toHaveURL(/resultado=por-votar/);
  // The proposals themselves, not the vote chips inside them.
  await expect(proposals.locator(":scope > li")).toHaveCount(3);

  // One by one from the start: by the parliament's number (1C, 2C…), across every day, keeping the tab; and back.
  const order = page.getByRole("navigation", { name: "Ordem" });
  await expect(order.getByRole("link", { name: "Última votação" })).toHaveAttribute("aria-current", "true");
  await order.getByRole("link", { name: "Número" }).click();
  await expect(page).toHaveURL(/resultado=por-votar.*ordem=numero/);
  await expect(order.getByRole("link", { name: "Número" })).toHaveAttribute("aria-current", "true");
  await page.goto("/orcamento?ordem=numero#propostas");
  const numbers = (await proposals.locator(":scope > li").allInnerTexts()).map((text) => Number(/n\.º (\d+)C/.exec(text)![1]));
  expect(numbers.length).toBeGreaterThan(3);
  expect(numbers).toEqual([...numbers].sort((a, b) => a - b));
  // The search keeps the order.
  await page.getByRole("searchbox", { name: "Procurar nas propostas" }).fill("irs");
  await page.getByRole("button", { name: "Filtrar" }).click();
  await expect(page).toHaveURL(/q=irs.*ordem=numero|ordem=numero.*q=irs/);
  await order.getByRole("link", { name: "Última votação" }).click();
  await expect(page).not.toHaveURL(/ordem=/);

  // A search, then a proposal opened in place.
  await page.goto("/orcamento?q=irs#propostas");
  const irs = proposals.locator(":scope > li").filter({ hasText: "Artigo 9.º do Código do IRS" });
  await irs.getByText("Artigo 9.º do Código do IRS").click();
  await expect(irs).toContainText("Rui Valadares: contra");
  // The official title stays the heading; the summary under it, labelled «Resumo», marked as written by a model.
  await expect(irs.getByRole("heading", { level: 3 })).toHaveText("Artigo 9.º do Código do IRS");
  await expect(irs).toContainText("ResumoMuda os escalões do IRS Jovem");
  await expect(irs).toContainText("Resumo automático");
  await expect(irs.getByRole("link", { name: /PDF oficial/ })).toHaveAttribute("href", "https://example.com/oe/28301.pdf");
  await irs.getByRole("link", { name: /Página da proposta/ }).click();
  await expect(page).toHaveURL(/\/orcamento\/2027\/proposta\/28301$/);
  // The official title leads; the summary under it, labelled «Resumo», so it's never taken for the official text.
  await expect(page.getByRole("heading", { level: 1, name: "Artigo 9.º do Código do IRS" })).toBeVisible();
  const summary = page.getByRole("region", { name: "Resumo" });
  await expect(summary).toContainText("Muda os escalões do IRS Jovem para quem tem até 35 anos.");
  await expect(page.getByText("Título oficial:")).toHaveCount(0);
  await expect(page.getByText(/^Votada a \d\d-\d\d-\d{4}, em Comissão$/)).toBeVisible();
  await expect(page.locator("dl").getByText("Partido Social Democrata", { exact: true })).toBeVisible();
  // The source's «Aprovado(a)» reads as a sentence; the share text says «do PSD».
  await expect(page.getByText("Aprovada em Comissão", { exact: true })).toBeVisible();
  await expect(page.getByText(/\(a\)/)).toHaveCount(0);
  expect(await page.locator('meta[name="description"]').getAttribute("content")).toContain("para 2027, do PSD:");
  await expect(page.getByText("Aprovada", { exact: true }).first()).toBeVisible();
  // «O que disseram»: from the news, grouped by party, each linking to its article; a voice without a party is left out.
  const said = page.getByRole("region", { name: "O que disseram" });
  await expect(said).toContainText("das notícias, não do registo do Parlamento");
  await expect(said.getByRole("heading", { level: 3 })).toHaveText(["Partido Social Democrata", "Partido Socialista"]);
  // Shown as the article has it (a quote in «» or a paraphrase): never wrapped in quotes of our own.
  await expect(said.getByText("Diz que os mais novos ficam com «mais rendimento disponível».", { exact: true })).toBeVisible();
  await expect(said).toContainText("Rui Valadares");
  await expect(said).not.toContainText("Teresa Amaral");
  await expect(said.getByRole("link", { name: /^segundo / }).first()).toHaveAttribute("href", "/article/100");
  // «Nas notícias», newest first, to the article's page here.
  const news = page.getByRole("region", { name: "Nas notícias" });
  await expect(news.getByRole("link")).toHaveCount(2);
  await expect(news.getByRole("link").first()).toHaveAttribute("href", "/article/100");
  await noSeriousA11yIssues(page);
  // Empty until the backend fills them: no sections at all.
  await page.goto("/orcamento/2027/proposta/28302");
  await expect(page.getByRole("region", { name: "A votação" })).toBeVisible();
  await expect(page.getByRole("region", { name: "O que disseram" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Nas notícias" })).toHaveCount(0);

  await page.goto("/orcamento");
  // When a session began, never «a decorrer»: the parliament doesn't say when it ends.
  if (!isMobile) {
    const side = page.getByRole("region", { name: "Orçamento do Estado 2027" });
    await expect(side).toContainText(/Começou às \d\dh\d\d/);
    // The count is at the top already: the side box doesn't repeat it.
    await expect(side).not.toContainText("por votar");
    await expect(side.getByRole("img", { name: /^Propostas de alteração/ })).toHaveCount(0);
  }
  // «por votar» once in the tally, not again in its legend.
  await expect(page.getByRole("region", { name: /propostas de alteração já votadas/ }).getByText(/por votar/)).toHaveCount(1);
  await noSeriousA11yIssues(page);
});

test("State Budget: a past one has its final vote, a summary per party and every proposal; before 2006, only its votes", async ({
  page,
}) => {
  await page.goto("/orcamento/2026");
  await expect(page.getByRole("heading", { level: 1, name: "Orçamento do Estado 2026" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Votação final global" })).toContainText("CDS-PP");
  await expect(page.getByRole("region", { name: "Resumo por partido" })).toContainText("PSD");
  await expect(page.getByRole("list", { name: "Propostas de alteração" }).locator(":scope > li")).toHaveCount(4);
  await noSeriousA11yIssues(page);

  await page.goto("/orcamento/2005");
  await expect(page.getByRole("region", { name: "Votação final global" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Propostas de alteração" })).toHaveCount(0);

  // The current year lives at /orcamento; an unknown one is not found.
  await page.goto("/orcamento/2027");
  await expect(page).toHaveURL(/\/orcamento$/);
  const missing = await page.goto("/orcamento/1990");
  expect(missing?.status()).toBe(404);
});

test("the Budget's box beside the news, on wide screens", async ({ page, isMobile }) => {
  test.skip(isMobile, "Beside the news only on wide screens.");
  await gotoReady(page, "/");
  const box = page.getByRole("complementary", { name: "Ao lado das notícias" }).getByRole("region", { name: "Orçamento do Estado 2027" });
  await expect(box).toContainText("votadas");
  await expect(box).toContainText("Última votação");
  await box.getByRole("link", { name: /Ver as votações de hoje/ }).click();
  await expect(page).toHaveURL(/\/orcamento\?dia=\d{4}-\d{2}-\d{2}#propostas$/);
});

test("State Budget: a filter shows it's loading while the next list comes", async ({ page }) => {
  await gotoReady(page, "/orcamento");
  // The server can take seconds: hold the next page back to see the wait.
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route(/\/orcamento\?.*resultado=por-votar/, async (route) => {
    await held;
    await route.continue();
  });
  const loading = page.getByRole("status").filter({ hasText: "A carregar as propostas…" });
  await expect(loading).toHaveCount(0);
  await page
    .getByRole("navigation", { name: "Resultado" })
    .getByRole("link", { name: /^Por votar/ })
    .click();
  await expect(loading).toBeVisible();
  release();
  await expect(page).toHaveURL(/resultado=por-votar/);
  await expect(loading).toHaveCount(0);

  // The search too, on its button.
  await page.unroute(/\/orcamento\?.*resultado=por-votar/);
  let releaseSearch!: () => void;
  const heldSearch = new Promise<void>((resolve) => (releaseSearch = resolve));
  await page.route(/\/orcamento\?.*q=irs/, async (route) => {
    await heldSearch;
    await route.continue();
  });
  await page.getByRole("searchbox", { name: "Procurar nas propostas" }).fill("irs");
  await page.getByRole("button", { name: "Filtrar" }).click();
  await expect(page.getByRole("button", { name: "A filtrar…" })).toBeVisible();
  await expect(loading).toBeVisible();
  releaseSearch();
  await expect(page).toHaveURL(/q=irs/);
  await expect(page.getByRole("button", { name: "Filtrar" })).toBeVisible();
});

test("State Budget: what's planned for today and the days ahead, from the parliament's voting scripts", async ({ page }) => {
  const lisbon = (offset: number) => new Date(Date.now() + offset * 86_400_000).toLocaleDateString("sv-SE", { timeZone: "Europe/Lisbon" });
  const [today, tomorrow] = [lisbon(0), lisbon(1)];
  const dmy = (date: string) => date.split("-").reverse().join("-");
  await gotoReady(page, "/orcamento");
  // Today's box: what's planned, in voting order, the voted ones with their result.
  const box = page.getByRole("region", { name: /^Votações de hoje/ });
  const planned = box.getByRole("list", { name: "Em votação hoje" });
  await expect(box).toContainText("Em votação hoje · previsto · 4 propostas");
  // Some of today's results are in: nothing to explain (none in would read «Resultados … ainda não publicados pelo Parlamento»).
  await expect(box).not.toContainText("ainda não publicados");
  await expect(planned.getByRole("listitem")).toHaveText([
    /Aprovada.*Artigo 9\.º do Código do IRS/,
    /Rejeitada.*Artigo 2\.º do Código do IMI/,
    /Por votar.*Artigo 87\.º do Código do IRC/,
    /Por votar.*Artigo 140\.º · Serviço Nacional de Saúde/,
  ]);
  // The days ahead, one line each, to that day's list.
  const ahead = box.getByRole("list", { name: "Próximos dias previstos" });
  await expect(ahead.getByRole("link")).toHaveText([`${dmy(tomorrow)} · 1 proposta · em plenário`]);
  await expect(ahead.getByRole("link")).toHaveAttribute("href", `/orcamento?previsto=${tomorrow}#propostas`);

  // The day's list: in the scripts' order.
  await box.getByRole("link", { name: /Ver as 4 previstas para hoje/ }).click();
  await expect(page).toHaveURL(new RegExp(`previsto=${today}`));
  const proposals = page.getByRole("list", { name: "Propostas de alteração" }).locator(":scope > li");
  await expect(proposals).toHaveCount(4);
  await expect(proposals.first()).toContainText("Artigo 9.º do Código do IRS");
  await expect(page.getByText(`Previstas para votação a ${dmy(today)}`)).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Ordem" }).getByRole("link", { name: "Ordem de votação" })).toHaveAttribute(
    "aria-current",
    "true",
  );
  // Still to vote: when and where it's planned, and the script; voted: the result instead.
  const irc = proposals.filter({ hasText: "Artigo 87.º do Código do IRC" });
  await expect(irc).toContainText("Prevista para votação hoje, em comissão");
  await expect(proposals.first()).not.toContainText("Prevista para votação");
  await irc.getByText("Artigo 87.º do Código do IRC").click();
  await expect(irc.getByRole("link", { name: /Guião de votações/ })).toHaveAttribute("href", "https://example.com/oe/guiao-comissao.pdf");
  await irc.getByRole("link", { name: /Página da proposta/ }).click();
  await expect(page).toHaveURL(/\/orcamento\/2027\/proposta\/28306$/);
  await expect(page.getByText("Prevista para votação hoje, em comissão")).toBeVisible();
  await expect(page.getByRole("link", { name: /Guião de votações/ })).toHaveAttribute("href", "https://example.com/oe/guiao-comissao.pdf");
  await noSeriousA11yIssues(page);
});

test("State Budget: follow a proposal still to vote, see it under «A seguir», get its vote in the inbox, and stop", async ({ page }) => {
  const username = await signUp(page);
  // Voted already: nothing left to tell, no button.
  await page.goto("/orcamento/2027/proposta/28301");
  await expect(page.getByRole("heading", { level: 1, name: "Artigo 9.º do Código do IRS" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Seguir esta proposta/ })).toHaveCount(0);
  // Still to vote: «Seguir», then «A seguir».
  await page.goto("/orcamento/2027/proposta/28306");
  const follow = page.getByRole("button", { name: "Seguir esta proposta" });
  await follow.click();
  await expect(page.getByRole("button", { name: "A seguir esta proposta" })).toHaveAttribute("aria-pressed", "true");

  // In the list too, opened in place.
  await page.goto("/orcamento?resultado=por-votar#propostas");
  const sns = page.getByRole("list", { name: "Propostas de alteração" }).locator(":scope > li").filter({ hasText: "Artigo 140.º" });
  await sns.getByText("Artigo 140.º · Serviço Nacional de Saúde").click();
  await sns.getByRole("button", { name: /^Seguir/ }).click();
  await expect(sns.getByRole("button", { name: /^A seguir/ })).toHaveAttribute("aria-pressed", "true");

  // «A seguir», from the account's menu: newest followed first, with where each stands.
  await page
    .getByRole("button", { name: new RegExp(username) })
    .first()
    .click();
  await page
    .getByRole("region", { name: "A tua conta" })
    .getByRole("link", { name: /A seguir/ })
    .click();
  await expect(page).toHaveURL(/\/conta\/seguir$/);
  await expect(page.getByRole("heading", { level: 1, name: "A seguir" })).toBeVisible();
  const followed = page.getByRole("list", { name: "Propostas que segues" }).getByRole("listitem");
  await expect(followed).toHaveCount(2);
  await expect(followed.first()).toContainText("Artigo 140.º · Serviço Nacional de Saúde");
  await expect(followed.nth(1)).toContainText("Prevista para votação hoje, em comissão");
  await noSeriousA11yIssues(page);

  // The vote, in the inbox, to the proposal's page.
  await page.goto("/conta/notificacoes");
  const line = page.getByRole("list", { name: "Notificações" }).getByRole("listitem").filter({ hasText: "Artigo 87.º do Código do IRC" });
  await expect(line).toContainText("Aprovada em comissão: Artigo 87.º do Código do IRC (1450C)");
  await expect(line.getByRole("link").first()).toHaveAttribute("href", "/orcamento/2027/proposta/28306");

  // Stop following, from «A seguir».
  await page.goto("/conta/seguir");
  await followed
    .first()
    .getByRole("button", { name: /^A seguir/ })
    .click();
  await page.reload();
  await expect(followed).toHaveCount(1);
});

test("State Budget: «A seguir» asks to log in first", async ({ page }) => {
  await page.goto("/conta/seguir");
  await expect(page.getByRole("heading", { level: 1, name: "A seguir" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Entrar" }).first()).toBeVisible();
});

test("State Budget: a final vote taken from the news, before the parliament publishes it, says it's provisional and links its source", async ({
  page,
}) => {
  await page.goto("/orcamento/2026");
  const final = page.getByRole("region", { name: "Votação final global" });
  await expect(final).toContainText("Provisório (fonte: Jornal de Exemplo");
  await expect(final).toContainText("), ainda não publicado pelo Parlamento");
  await expect(final.getByRole("link", { name: /Jornal de Exemplo/ })).toHaveAttribute("href", "https://exemplo.pt/orcamento-aprovado");

  // After the final vote, what's still open was almost certainly voted: its result isn't published yet, not «por votar».
  await expect(page.getByRole("navigation", { name: "Resultado" })).toContainText("Resultado por publicar");
  const open = page.getByRole("list", { name: "Propostas de alteração" }).locator(":scope > li").filter({ hasText: "Abono de família" });
  await expect(open).toContainText("Resultado por publicar");
  await expect(open).toContainText("resultado por publicar");
  await expect(page.getByText(/por votar/i)).toHaveCount(0);
  await noSeriousA11yIssues(page);

  await page.goto("/orcamento/2026/proposta/26004");
  await expect(page.getByText("Resultado por publicar").first()).toBeVisible();
});

test("State Budget: after the vote, what the Government announced, dated and sourced, and the proposals it says it won't apply", async ({
  page,
}) => {
  await page.goto("/orcamento");
  const after = page.getByRole("region", { name: "Depois da votação" });
  await expect(after).toContainText("não vai aplicar uma norma aprovada");
  await expect(after).toContainText("26-11-2026");
  await expect(after.getByRole("link", { name: /Jornal de Exemplo/ })).toHaveAttribute("href", "https://exemplo.pt/governo-normas-orcamento");
  await noSeriousA11yIssues(page);

  // The list of those proposals, from the filter's total: one here.
  await after.getByRole("link", { name: "A proposta que o Governo diz que não vai aplicar" }).click();
  await expect(page).toHaveURL(/aplicacao=nao-aplicadas/);
  const list = page.getByRole("list", { name: "Propostas de alteração" });
  await expect(list.locator(":scope > li")).toHaveCount(1);
  await expect(list).toContainText("Comissão de reembolso antecipado");
  await expect(list).toContainText("O Governo diz que não vai aplicar");
  await expect(page.getByText("Que o Governo diz que não vai aplicar ·")).toBeVisible();

  // On the proposal's page: the status, its note, date and source.
  await page.goto("/orcamento/2027/proposta/28304");
  const status = page.getByRole("region", { name: "Depois da votação" });
  await expect(status).toContainText("O Governo diz que não vai aplicar");
  await expect(status).toContainText("O Governo invoca a lei-travão.");
  await expect(status).toContainText("26-11-2026");
  await expect(status.getByRole("link", { name: /Jornal de Exemplo/ })).toHaveAttribute("href", "https://exemplo.pt/governo-normas-orcamento");
  await noSeriousA11yIssues(page);

  // Nothing recorded: nothing shown.
  await page.goto("/orcamento/2027/proposta/28301");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("region", { name: "Depois da votação" })).toHaveCount(0);
  await page.goto("/orcamento/2026");
  await expect(page.getByRole("heading", { level: 1, name: "Orçamento do Estado 2026" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Depois da votação" })).toHaveCount(0);
});
