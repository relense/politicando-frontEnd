import { expect, test } from "@playwright/test";
import { gotoReady, noSeriousA11yIssues, openNewsSearch, signUp } from "./helpers";
import { FEATURES } from "../lib/features";

test("feed shows a page of news, then a button for more, until the end", async ({ page }) => {
  test.skip(FEATURES.stories, "Articles feed: with stories, see the stories test.");
  await page.goto("/");
  await expect(page.getByRole("article")).toHaveCount(30);
  // No endless scrolling: going to the bottom loads nothing by itself, so the footer can be reached.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(page.getByRole("contentinfo")).toBeInViewport();
  await expect(page.getByRole("article")).toHaveCount(30);
  await page.getByRole("button", { name: "Carregar mais notícias" }).click();
  await expect(page.getByRole("article")).toHaveCount(35);
  await expect(page.getByText("Não há mais notícias.")).toBeVisible();
});

test("hostile title stays harmless text", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: /<script>window.__xss/ }).first()).toBeVisible();
  expect(await page.evaluate(() => "__xss" in window)).toBe(false);
});

test("direct party URL works, and unknown party is a real 404", async ({ page }) => {
  await page.goto("/partido/cds-pp");
  await expect(page.getByRole("heading", { level: 1, name: "CDS - Partido Popular" })).toBeVisible();
  await expect(page.getByRole("article").first()).toContainText("CDS-PP");
  await expect(page.getByRole("region", { name: "Sobre o partido" })).toContainText("humanismo personalista");
  await expect(page.getByRole("link", { name: /apresentação do próprio partido/ })).toHaveAttribute(
    "href",
    "https://www.cds.pt/principios.html",
  );

  const response = await page.goto("/partido/nao-existe");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Página não encontrada" })).toBeVisible();
});

test("old party URLs redirect to the current slug", async ({ page }) => {
  await page.goto("/partido/l");
  await expect(page).toHaveURL(/\/partido\/livre$/);
  await page.goto("/partido/pctp");
  await expect(page).toHaveURL(/\/partido\/pctp-mrpp$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Partido Comunista dos Trabalhadores Portugueses");
});

test("missing and malformed articles are real 404s", async ({ request }) => {
  expect((await request.get("/article/99999")).status()).toBe(404);
  expect((await request.get("/article/abc")).status()).toBe(404);
  expect((await request.get("/article/99999999999")).status()).toBe(404);
});

test("home scrolling still loads the home feed after visiting a party", async ({ page }) => {
  test.skip(FEATURES.stories, "Articles feed: with stories, see the stories test.");
  await page.goto("/partido/be");
  await page.getByRole("link", { name: "POLITICANDO", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Últimas notícias" })).toBeVisible();
  await expect(page.getByRole("article").first()).toContainText("número 100");
  await page.getByRole("button", { name: "Carregar mais notícias" }).click();
  await expect(page.getByRole("article").nth(30)).toContainText("número 70");
});

test("back navigation shows the right article", async ({ page }) => {
  await page.goto("/article/100");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("número 100");
  await page.goto("/article/98");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("número 98");
  await page.goBack();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("número 100");
});

test("post a comment and a reply; API errors are shown", async ({ page }) => {
  await signUp(page);
  const unique = `Comentário ${Date.now()}`;
  await page.goto("/article/97");
  await page.getByRole("button", { name: "Junta-te à conversa…" }).click();
  const form = page.locator("main form").first();

  await form.getByRole("button", { name: "Publicar" }).click();
  await expect(form.getByRole("alert")).toContainText("Escreve um comentário");

  await form.getByLabel("Comentário").fill("ERRO-SERVIDOR");
  await form.getByRole("button", { name: "Publicar" }).click();
  await expect(form.getByRole("alert")).toContainText("Não foi possível publicar");
  await expect(form.getByLabel("Comentário")).toHaveValue("ERRO-SERVIDOR");

  // Refused text: the API's own words, and what was typed stays to fix.
  await form.getByLabel("Comentário").fill("Escrevam-me para ana@exemplo.pt");
  await form.getByRole("button", { name: "Publicar" }).click();
  await expect(form.getByRole("alert")).toContainText("tem um email ou um número de telefone");
  await expect(form.getByLabel("Comentário")).toHaveValue("Escrevam-me para ana@exemplo.pt");

  await form.getByLabel("Comentário").fill(unique);
  await form.getByRole("button", { name: "Publicar" }).click();
  await expect(page.getByText(unique, { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Junta-te à conversa…" })).toBeVisible();

  await page.getByRole("button", { name: "Responder" }).last().click();
  const replyForm = page.locator("main form", { has: page.getByRole("textbox", { name: "Resposta" }) });
  await replyForm.getByRole("textbox", { name: "Resposta" }).fill(`Resposta a ${unique}`);
  await replyForm.getByRole("button", { name: "Publicar" }).click();
  await expect(page.locator("p", { hasText: `Resposta a ${unique}` })).toBeVisible();

  await page.reload();
  await expect(page.getByText(unique, { exact: true })).toBeVisible();
});

test("the party filter narrows the news in place and marks the chosen party", async ({ page }) => {
  await page.goto("/");
  const quick = page.getByRole("navigation", { name: "Filtrar notícias" }).getByRole("list", { name: "Partidos com deputados" });
  await quick.getByRole("button", { name: /PSD/ }).click();
  await expect(page).toHaveURL(/\/\?partido=psd$/);
  await expect(page.getByRole("heading", { level: 1, name: "Notícias do Partido Social Democrata" })).toBeVisible();
  await expect(quick.getByRole("button", { name: /PSD/ })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Tirar PSD" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Últimas notícias" })).toBeVisible();
});

test("news from several parties and several papers, saved as the reader's own feed", async ({ page }) => {
  await page.goto("/");
  const filters = page.getByRole("navigation", { name: "Filtrar notícias" });
  // Parties: in a panel, with a search; ticked choices apply together.
  await filters.getByRole("button", { name: /^Partidos/ }).click();
  const partiesPanel = page.getByRole("dialog", { name: "Escolher partidos" });
  await partiesPanel.getByRole("checkbox", { name: "B.E." }).check();
  await partiesPanel.getByRole("searchbox", { name: "Procurar partido" }).fill("liberal");
  await partiesPanel.getByRole("checkbox", { name: "IL" }).check();
  await partiesPanel.getByRole("button", { name: /^Mostrar (\d+ )?notícias?$/ }).click();
  await expect(page).toHaveURL(/partido=be,il$/);
  await expect(filters.getByRole("button", { name: /^Partidos/ })).toContainText("2");
  // Papers, the same way.
  await filters.getByRole("button", { name: /^Jornais/ }).click();
  const papersPanel = page.getByRole("dialog", { name: "Escolher jornais" });
  await papersPanel.getByRole("checkbox", { name: /Público/ }).check();
  await papersPanel.getByRole("checkbox", { name: /RTP/ }).check();
  await papersPanel.getByRole("button", { name: /^Mostrar (\d+ )?notícias?$/ }).click();
  await expect(page).toHaveURL(/partido=be,il&fonte=publico\.pt,rtp\.pt$/);
  await expect(page.getByRole("heading", { level: 1, name: "Notícias escolhidas" })).toBeVisible();
  // Every card is about one of the two parties, from one of the two papers.
  const cards = page.getByRole("article");
  await expect(cards.first()).toBeVisible();
  for (const card of await cards.all()) {
    await expect(card).toContainText(/B\.E\.|IL/);
    await expect(card).toContainText(/Público|RTP/);
  }
  // A search stays within the choice, and so does the order.
  await openNewsSearch(page);
  await page.getByRole("searchbox", { name: "Procurar nas notícias" }).fill("número");
  await page.getByRole("button", { name: "Procurar", exact: true }).click();
  await expect(page).toHaveURL(/partido=be,il&fonte=publico\.pt,rtp\.pt&q=n%C3%BAmero$/);
  // The order: underlined tabs; a ranked order adds the period beside them.
  // Stories (FEATURES.stories) are ordered by how many outlets told them instead of by comments.
  const [sortName, sortValue] = FEATURES.stories ? ["Mais noticiadas", "noticiadas"] : ["Mais comentadas", "comentadas"];
  await filters.getByRole("button", { name: new RegExp(`^${sortName}`) }).click();
  await expect(page).toHaveURL(new RegExp(`&ordem=${sortValue}$`));
  await expect(filters.getByRole("button", { name: new RegExp(`^${sortName}`) })).toHaveAttribute("aria-pressed", "true");
  await filters.getByRole("button", { name: "7 dias", exact: true }).click();
  await filters.getByRole("button", { name: "30 dias" }).click();
  await expect(page).toHaveURL(new RegExp(`&ordem=${sortValue}&periodo=mes$`));
  await expect(page.getByText(new RegExp(`as ${sortName.toLowerCase()} dos últimos 30 dias primeiro`, "i"))).toBeVisible();

  // Saved, the front page opens with it; "Limpar tudo" shows everything without forgetting it.
  await page.goto("/?partido=be,il&fonte=publico.pt,rtp.pt");
  await filters.getByRole("button", { name: /Guardar como o meu feed/ }).click();
  await expect(filters.getByText("★ O teu feed")).toBeVisible();
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "As tuas notícias" })).toBeVisible();
  await expect(filters.getByRole("button", { name: "Tirar IL" })).toBeVisible();
  await filters.getByRole("button", { name: "Limpar tudo" }).click();
  await expect(page).toHaveURL(/\?tudo=1$/);
  await expect(page.getByRole("heading", { level: 1, name: "Últimas notícias" })).toBeVisible();
  await filters.getByRole("button", { name: "Esquecer o meu feed" }).click();
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Últimas notícias" })).toBeVisible();
});

test("parties page: the seated parties with their leader and seats, then the rest, each opening its page", async ({ page }) => {
  await page.goto("/partidos");
  await expect(page.getByRole("heading", { level: 1, name: "Partidos" })).toBeVisible();
  const seated = page.getByRole("region", { name: "No Parlamento" });
  const first = seated.getByRole("listitem").first();
  await expect(first).toContainText("PSD");
  await expect(first).toContainText("em coligação");
  await expect(first.getByRole("link", { name: "Henrique Valadares" })).toHaveAttribute("href", /\/governo\/0+1$/);
  await expect(seated.getByRole("listitem").filter({ hasText: "B.E." })).toContainText("Marta Quintela");
  await expect(page.getByRole("region", { name: "Sem deputados" })).toContainText("PCTP/MRPP");
  await seated.getByRole("link", { name: "PS", exact: true }).click();
  await expect(page).toHaveURL(/\/partido\/ps$/);
  await noSeriousA11yIssues(page);
});

test("news have no party column: the party filter sits above the feed, the blog and figures beside it", async ({ page, isMobile }) => {
  await page.goto("/");
  // No party column: the only column beside the news is the blog box and the figures.
  await expect(page.locator("aside")).toHaveCount(1);
  const beside = page.getByRole("complementary", { name: "Ao lado das notícias" });
  await expect(beside.locator('a[href^="/partido/"]')).toHaveCount(0);
  // Who holds power, in plain words: the President, the Prime Minister, who won and how Parliament is split.
  // The column only shows on wide screens.
  if (!isMobile) {
    const power = beside.getByRole("region", { name: "Agora no poder" });
    await expect(power.getByRole("link", { name: /Presidente da República/ })).toHaveAttribute("href", "/presidente");
    await expect(power.getByRole("link", { name: /Primeiro-Ministro/ })).toHaveAttribute("href", "/governo");
    await expect(power.getByRole("link", { name: /Quem ganhou as últimas legislativas/ })).toHaveAttribute(
      "href",
      /^\/eleicoes\/legislativas-/,
    );
    await expect(power.getByRole("link", { name: /Parlamento hoje/ })).toHaveAttribute("href", "/parlamento");
  }
  const filter = page.getByRole("navigation", { name: "Filtrar notícias" });
  // The order: underlined tabs, "Recentes" chosen.
  await expect(filter.getByRole("button", { name: "Recentes", exact: true })).toHaveAttribute("aria-pressed", "true");
  // Party pages have no filter row: they are reached from the parties page.
  await page.goto("/partido/ps");
  await expect(page.getByRole("navigation", { name: "Filtrar notícias" })).toHaveCount(0);
});

test("drawer works by keyboard", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Desktop shows the sections column instead of the menu.");
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "Abrir menu" });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const drawer = page.getByRole("dialog", { name: "Menu" });
  await expect(drawer).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
  await expect(trigger).toBeFocused();

  await page.keyboard.press("Enter");
  await drawer.getByRole("link", { name: /Partidos/ }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/partidos$/);
  await expect(drawer).toBeHidden();
});

test("article HTML carries SEO data without JavaScript", async ({ request }) => {
  const html = await (await request.get("/article/100")).text();
  expect(html).toContain("<title>Notícia de teste número 100");
  expect(html).toContain('property="og:title"');
  expect(html).toContain('"@type":"NewsArticle"');
  expect(html).toContain('lang="pt-PT"');
  expect(html).toContain('rel="canonical"');
  expect(html).toContain("Este é o texto de exemplo");
});

test("the home page names its one address for search engines, whatever the order or period", async ({ request }) => {
  for (const path of ["/", "/?ordem=votadas&periodo=hoje"]) {
    const html = await (await request.get(path)).text();
    // The site's address alone: politicando.pt, the www one and every ?ordem= are one page.
    expect(html).toMatch(/<link rel="canonical" href="https?:\/\/[^"/]+\/?"\/>/);
  }
});

test("article page shows the excerpt and links to the original", async ({ page }) => {
  await page.goto("/article/100");
  const link = page.getByRole("link", { name: /Ler o artigo completo em Público/ });
  await expect(link).toHaveAttribute("href", "https://example.com/noticia/100");
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(page.getByText(/^Este é o texto de exemplo da notícia 100\./)).toContainText("…");
  await expect(page.locator("article time").first()).toContainText(/^[A-ZÁÉ][a-zçá-]+(-feira)?, \d+ de /);
  await expect(page.getByRole("button", { name: "Copiar ligação" })).toBeVisible();
  // The people it names who have a page here, each linked to it.
  await expect(page.getByRole("link", { name: "Marta Quintela", exact: true })).toHaveAttribute("href", "/autarcas/marta-quintela");
  await expect(page.locator('a[href^="/deputados/"]', { hasText: /\S/ }).first()).toBeVisible();
  // Beside it: its parties with their forums, more news about each, the context in Parliament and the map.
  const beside = page.getByRole("complementary", { name: "Sobre esta notícia" });
  await expect(beside.getByRole("heading", { name: "Partidos nesta notícia" })).toBeVisible();
  await expect(beside.getByRole("link", { name: /^Discutir no fórum do / }).first()).toHaveAttribute(
    "href",
    /\/forum\/[a-z-]+\?artigo=100#nova/,
  );
  const more = beside.getByRole("region", { name: "Mais sobre" });
  await expect(more.getByRole("link", { name: /^Todas as notícias do / })).toBeVisible();
  await expect(beside.getByRole("link", { name: /Contexto/ })).toHaveAttribute("href", /^\/iniciativas/);
  await expect(beside.getByRole("link", { name: /Quem governa a tua câmara/ })).toHaveAttribute("href", "/sitios");
  await expect(page.getByRole("link", { name: "Últimas notícias" })).toHaveAttribute("href", "/");
});

test("feed images and titles open our article page", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("article").first().getByRole("heading").getByRole("link").click();
  await expect(page).toHaveURL(/\/article\/100$/);
});

test("article without an excerpt still renders", async ({ page }) => {
  await page.goto("/article/99");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Título com código");
  await expect(page.getByRole("link", { name: /Ler o artigo completo/ })).toBeVisible();
});

test("hostile title cannot break out of JSON-LD", async ({ request }) => {
  const html = await (await request.get("/article/99")).text();
  expect(html).not.toContain("<script>window.__xss");
});

// The list pages have loading screens; the pages under them don't, or a missing one would answer 200 instead of 404.
test("pages under the list pages with loading screens are still real 404s", async ({ request }) => {
  for (const path of [
    "/iniciativas/987654321",
    "/governo/nao-existe",
    "/eleicoes/nao-existe",
    "/sitios/LOCAL-999999",
    "/contratos/987654321",
    "/contratos/entidade/000000000",
    "/legislaturas/nao-existe",
    "/editorial/nao-existe",
    "/forum/nao-existe",
    "/feedback/ideias/987654321",
    "/partido/nao-existe",
  ])
    expect((await request.get(path)).status(), path).toBe(404);
});

test("sitemap and robots are served", async ({ request }) => {
  const sitemap = await (await request.get("/sitemap.xml")).text();
  // News pages carry another outlet's text: out of the map and noindex. Our own pages are all in.
  expect(sitemap).not.toContain("/article/");
  expect(sitemap).toContain("/partido/cds-pp");
  expect(sitemap).toContain("/deputados/1100");
  // Mayors have their own pages.
  expect(sitemap).toContain("/autarcas/marta-quintela");
  expect(sitemap).toContain("/governo/00000000000000000000000000000001");
  expect(sitemap).toContain("/eleicoes/legislativas-2025/LOCAL-110000");
  expect(sitemap).toContain("/eleicoes/legislativas-2025/LOCAL-111100");
  expect(sitemap).toContain("/editorial/como-se-faz-uma-lei");
  expect(sitemap).toContain("/historia");
  expect(sitemap).toContain("/sitios/LOCAL-111100");
  expect(sitemap).toMatch(/\/iniciativas\/\d+<\/loc>\s*<lastmod>2026-11-01/);
  expect(sitemap).not.toContain("presidente-ficticio");
  expect(await (await request.get("/article/100")).text()).toMatch(/<meta name="robots" content="noindex, follow"/);
  expect(sitemap).toContain("/parlamento");
  expect(sitemap).not.toMatch(/\/deputados<\/loc>/);
  expect(sitemap).toContain("/governo");
  expect(sitemap).toContain("/eleicoes");
  expect(await (await request.get("/robots.txt")).text()).toContain("Sitemap:");
  // Filtered lists (Search Console, 23 Nov): one filter is indexed; combinations and stages are not; another order points to the list.
  const robotsOf = async (path: string) =>
    /<meta name="robots" content="([^"]+)"/.exec(await (await request.get(path)).text())?.[1] ?? null;
  expect(await robotsOf("/iniciativas?partido=psd")).toBeNull();
  expect(await robotsOf("/iniciativas?partido=psd&tema=transparencia")).toBe("noindex, follow");
  expect(await robotsOf("/iniciativas?fase=president")).toBe("noindex, follow");
  expect(await (await request.get("/forum/geral?ordem=recentes")).text()).toMatch(/<link rel="canonical" href="[^"]*\/forum\/geral"\/>/);
});

for (const colorScheme of ["light", "dark"] as const) {
  for (const path of [
    "/",
    "/partido/ps",
    "/partido/ps?ver=votacoes",
    "/article/100",
    "/parlamento",
    "/parlamento?partido=psd",
    "/parlamento?deputado=1100",
    "/deputados/1100",
    "/governo",
    "/governo/00000000000000000000000000000001",
    "/eleicoes",
    "/eleicoes/legislativas-2025",
    "/eleicoes/legislativas-2025/LOCAL-010000",
    "/historia",
    "/partidos",
    "/editorial",
    "/editorial/a-maioria-que-nao-existe",
    "/editorial/o-que-muda-no-orcamento",
    "/editorial/como-se-chega-a-deputado",
    "/privacidade",
    "/cookies",
    "/termos",
    "/legislaturas",
    "/agenda",
    "/feedback",
    "/feedback/correcoes",
    "/feedback/nova",
    "/feedback/nova?tipo=erro",
    "/feedback/ideias/501",
    "/legislaturas/XVII",
  ]) {
    test(`no accessibility violations: ${path} (${colorScheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      await page.goto(path);
      await expect(page.locator("main")).toBeVisible();
      // Under load the page can still be streaming in: wait for its title before checking.
      await expect(page.locator("h1").first()).toBeAttached();
      await noSeriousA11yIssues(page);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      expect(overflow).toBe(false);
    });
  }
}

test("comments use >>number to quote, with a preview and a jump", async ({ page }) => {
  await signUp(page);
  const unique = `Citação ${Date.now()}`;
  await page.goto("/article/96");
  await page.getByRole("button", { name: "Junta-te à conversa…" }).click();
  const form = page.locator("main form").first();
  await form.getByLabel("Comentário").fill(`Primeiro ${unique}`);
  await form.getByRole("button", { name: "Publicar" }).click();
  const first = page.locator("article", { hasText: `Primeiro ${unique}` });
  await expect(first).toBeVisible();
  // It shows at once with a temporary number; wait for the one the API gave it.
  await expect(first).not.toHaveAttribute("id", /^comentario--/);
  const number = (await first.getAttribute("id"))!.replace("comentario-", "");

  await first.getByRole("button", { name: `No.${number}, citar este comentário` }).click();
  const quoteForm = page.locator("main form").first();
  await expect(quoteForm.getByLabel("Comentário")).toHaveValue(`>>${number}\n`);
  await quoteForm.getByLabel("Comentário").pressSequentially(`Segundo ${unique}`);
  await quoteForm.getByRole("button", { name: "Publicar" }).click();

  const second = page.locator("article", { hasText: `Segundo ${unique}` });
  const mention = second.getByRole("link", { name: `>>${number}` });
  await expect(mention).toBeVisible();
  await mention.hover();
  await expect(page.getByRole("tooltip")).toContainText(`Primeiro ${unique}`);
  await expect(first.getByText("Respostas:")).toBeVisible();
  await mention.click();
  await expect(page).toHaveURL(new RegExp(`#comentario-${number}$`));
});

test("parliament: press a seat to open the bench, pick a deputy, then browse initiatives", async ({ page, isMobile }) => {
  await page.goto("/");
  if (isMobile) {
    await page.getByRole("button", { name: "Abrir menu" }).click();
    await page
      .getByRole("dialog")
      .getByRole("link", { name: /Parlamento/ })
      .click();
  } else {
    await page
      .getByRole("navigation", { name: "Secções" })
      .getByRole("link", { name: /Parlamento/ })
      .click();
  }
  await expect(page).toHaveURL(/\/parlamento$/);
  await expect(page.getByRole("heading", { level: 1, name: "Quem está sentado onde" })).toBeVisible();
  await expect(page.getByRole("region", { name: /Parlamento ou Governo/ })).toBeVisible();

  const map = page.getByRole("group", { name: /Lugares do hemiciclo/ });
  await expect(map.getByRole("button")).toHaveCount(230);
  // A seat opens whoever sits there; the tooltip names them first.
  const seat = map.getByRole("button", { name: /Partido Socialista \(PS\)/ }).first();
  await seat.hover();
  await expect(page.getByRole("tooltip")).toContainText("(aproximado)");
  await seat.click();
  await expect(page).toHaveURL(/deputado=\d+/);
  await page.getByRole("button", { name: "← Bancada PS" }).click();
  await expect(page).toHaveURL(/partido=ps/);
  const bench = page.getByRole("region", { name: "Partido Socialista" });
  await expect(bench.getByText(/58 deputados/)).toBeVisible();

  const first = bench.getByRole("listitem").first().getByRole("button");
  const name = (await first.locator("span.flex-1").textContent())!;
  await first.click();
  await expect(page).toHaveURL(/deputado=\d+/);
  const card = page.getByRole("region", { name });
  await expect(card.getByText("Círculo")).toBeVisible();
  await expect(card.getByText(/assinadas/)).toBeVisible();

  // The keyboard reaches the seats too.
  await map.locator('[role="button"][tabindex="0"]').focus();
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/deputado=\d+/);

  // The initiatives have their own page now; the Parliament points there.
  await page.getByRole("link", { name: "Ver as iniciativas →" }).click();
  await expect(page).toHaveURL(/\/iniciativas$/);
});

test("deputies: the old list redirects to the hemicycle, where a search opens anyone's card, then their full profile", async ({ page }) => {
  // There is no list page any more: the Parliament, with the same party chosen, is the list.
  await page.goto("/deputados?partido=ps");
  await expect(page).toHaveURL(/\/parlamento\?partido=ps$/);
  const bench = page.getByRole("region", { name: "Partido Socialista" });
  await expect(bench.getByRole("listitem")).toHaveCount(58);
  // Each deputy in the bench with their photo, or their initials.
  await expect(bench.getByRole("listitem").first().locator("img, span[aria-hidden='true']").first()).toBeVisible();

  // The search finds someone by name, accents or not, and opens their card.
  const name = (await bench.getByRole("listitem").nth(3).locator("span.flex-1").textContent())!;
  const box = page.getByRole("combobox", { name: "Procurar deputado" });
  await box.fill(
    name
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase(),
  );
  await page
    .getByRole("option", { name: new RegExp(name) })
    .first()
    .click();
  await expect(page).toHaveURL(/deputado=\d+$/);
  const card = page.getByRole("region", { name });
  await expect(card.getByRole("tab", { name: "Votações" })).toBeVisible();
  await expect(box).toHaveValue("");

  // With the keyboard too.
  await box.fill(name);
  await box.press("ArrowDown");
  await box.press("Enter");
  await expect(page.getByRole("region", { name })).toBeVisible();

  await page.getByRole("region", { name }).getByRole("link", { name: "Ver ficha completa →" }).click();
  await expect(page).toHaveURL(/\/deputados\/\d+$/);
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Iniciativas que assina" })).toBeVisible();
  await page.getByRole("link", { name: "Ver no hemiciclo" }).click();
  await expect(page).toHaveURL(/\/parlamento\?deputado=\d+$/);
  await expect(page.getByRole("region", { name })).toBeVisible();
});

test("government: from the menu to a minister who came from Parliament, and on to their deputy record", async ({ page, isMobile }) => {
  await page.goto("/");
  if (isMobile) {
    await page.getByRole("button", { name: "Abrir menu" }).click();
    await page
      .getByRole("dialog")
      .getByRole("link", { name: /^Governo/ })
      .click();
  } else {
    await page
      .getByRole("navigation", { name: "Secções" })
      .getByRole("link", { name: /^Governo/ })
      .click();
  }
  await expect(page).toHaveURL(/\/governo$/);
  await expect(page.getByRole("heading", { level: 1, name: "Quem governa" })).toBeVisible();
  // At the table: pressing the Prime Minister opens their card beside it, and the address keeps the choice.
  await page.getByRole("button", { name: /Primeiro-Ministro.*Henrique Valadares/ }).click();
  await expect(page).toHaveURL(/membro=0+1$/);
  const card = page.getByRole("region", { name: "Henrique Valadares" });
  await expect(card.getByRole("link", { name: /Percurso e notícias/ })).toBeVisible();
  await card.getByRole("button", { name: "Fechar" }).click();
  await expect(card).toHaveCount(0);

  const members = page.getByRole("region", { name: "Todos os membros do Governo" });
  await members.getByRole("searchbox").fill("Presidência");
  await members.getByRole("row").filter({ hasText: "PSD" }).first().getByRole("link").click();
  await expect(page).toHaveURL(/\/governo\/[0-9a-f]{32}$/);
  await expect(page.getByText(/suspendeu o mandato para entrar no Governo/)).toBeVisible();
  await page.getByRole("link", { name: "Ver ficha de deputado" }).click();
  await expect(page).toHaveURL(/\/deputados\/\d+$/);
  await expect(page.getByRole("heading", { name: "Votações" })).toBeVisible();
});

test("elections: from the menu to a district and a municipality, and back up the breadcrumb", async ({ page, isMobile }) => {
  await page.goto("/");
  if (isMobile) {
    await page.getByRole("button", { name: "Abrir menu" }).click();
    await page
      .getByRole("dialog")
      .getByRole("link", { name: /Eleições/ })
      .click();
  } else {
    await page
      .getByRole("navigation", { name: "Secções" })
      .getByRole("link", { name: /Eleições/ })
      .click();
  }
  await expect(page).toHaveURL(/\/eleicoes$/);
  await expect(page.getByRole("heading", { level: 1, name: "Eleições" })).toBeVisible();
  // Not imported yet: shown, but not a link.
  await expect(page.getByRole("link", { name: /Legislativas 2019/ })).toHaveCount(0);

  // The latest legislativas are featured at the top, and not repeated in the cards.
  await expect(page.getByRole("region", { name: "Legislativas 2025" })).toContainText("Mais recente");
  await page
    .getByRole("link", { name: /Legislativas 2025/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/eleicoes\/legislativas-2025$/);
  await expect(page.getByRole("heading", { name: "O novo Parlamento" })).toBeVisible();
  await page.getByRole("link", { name: /Território nacional/ }).click();
  await page
    .getByRole("link", { name: /^Aveiro/ })
    .first()
    .click();
  await expect(page).toHaveURL(/LOCAL-010000$/);
  await expect(page.getByRole("heading", { level: 1, name: "Aveiro" })).toBeVisible();
  await page.getByRole("link", { name: /^Águeda Mais votado/ }).click();
  await expect(page).toHaveURL(/LOCAL-010100$/);
  await expect(page.getByRole("heading", { level: 1, name: "Águeda" })).toBeVisible();

  await page.getByRole("navigation", { name: "Caminho" }).getByRole("link", { name: "2025" }).click();
  await expect(page).toHaveURL(/\/eleicoes\/legislativas-2025$/);
});

test("elections: the coming ones sit beside the results, a scheduled date included", async ({ page }) => {
  await page.goto("/eleicoes");
  const coming = page.getByRole("region", { name: "Próximas eleições" });
  await expect(coming.locator('time[datetime="2029-10-07"]')).toBeVisible();
  // A scheduled election has no results yet, so it isn't one of the cards; nor does each type repeat the next one.
  const local = page.getByRole("region", { name: "Autárquicas" });
  await expect(local.getByRole("link", { name: /Autárquicas 2029/ })).toHaveCount(0);
  await expect(local.getByText("Próximas eleições")).toHaveCount(0);
});

test("elections: the latest of each type as cards, older ones one per line by decade", async ({ page }) => {
  await page.goto("/eleicoes");
  const legislativas = page.getByRole("region", { name: "Legislativas", exact: true });
  await expect(legislativas.getByRole("heading", { name: "Legislativas anteriores" })).toBeVisible();
  const seventies = legislativas.getByRole("region", { name: "Anos 70" });
  await expect(seventies.getByText("só o resultado nacional")).toBeVisible();
  await legislativas.getByRole("region", { name: "Anos 80" }).getByRole("link", { name: "Legislativas 1987" }).click();
  await expect(page).toHaveURL(/\/eleicoes\/legislativas-1987$/);

  // Its results stop at the country: a district has no list or map of places inside.
  await page.goto("/eleicoes/legislativas-1987/LOCAL-010000");
  await expect(page.getByRole("heading", { level: 1, name: "Aveiro" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Por concelho" })).toHaveCount(0);
  await page.goto("/eleicoes/legislativas-2025/LOCAL-010000");
  await expect(page.getByRole("heading", { name: "Por concelho" })).toBeVisible();
});

test("elections: the coming ones, regionais included, with the law's window until there is a date", async ({ page }) => {
  await page.goto("/eleicoes");
  const coming = page.getByRole("region", { name: "Próximas eleições" });
  await expect(coming.getByText("Regionais dos Açores 2028")).toBeVisible();
  await expect(coming.getByText(/Até ao fim de 2028/)).toBeVisible();
  await expect(coming.getByText(/Entre 14 de setembro e 14 de outubro de 2029/)).toBeVisible();
});

test("elections: unknown elections, places and bodies are real 404s", async ({ request }) => {
  expect((await request.get("/eleicoes/legislativas-1900")).status()).toBe(404);
  expect((await request.get("/eleicoes/legislativas-2025/LOCAL-999999")).status()).toBe(404);
  expect((await request.get("/eleicoes/legislativas-2025/nada")).status()).toBe(404);
  expect((await request.get("/eleicoes/legislativas-2025?orgao=CM")).status()).toBe(404);
});

test("parties can be ordered by votes, and the choice survives a reload", async ({ page }) => {
  await page.goto("/");
  const open = () =>
    page
      .getByRole("navigation", { name: "Filtrar notícias" })
      .getByRole("button", { name: /^Partidos/ })
      .click();
  const nav = page.getByRole("dialog", { name: "Escolher partidos" });
  const first = nav.locator("label").first();
  await open();
  await expect(first).toContainText("B.E.");
  await nav.getByRole("button", { name: "Mais votados" }).click();
  await expect(nav.getByRole("button", { name: "Mais votados" })).toHaveAttribute("aria-pressed", "true");
  await expect(first).toContainText("PSD");
  await page.reload();
  await open();
  await expect(first).toContainText("PSD");
  await nav.getByRole("button", { name: "A–Z" }).click();
  await expect(first).toContainText("B.E.");
});

// The position badge reads "×Contra": its mark (hidden from screen readers) and the word.
const CONTRA = /^×\s*Contra$/;

test("party page: Parliament card and tabs for deputies, initiatives and votes", async ({ page }) => {
  await page.goto("/partido/ps");
  const card = page.getByRole("region", { name: "PS no Parlamento" });
  await expect(card).toContainText("58");
  await expect(card).toContainText("de 230 lugares");
  await expect(card).toContainText("Legislativas 2025");

  await page.getByRole("link", { name: "Ver os 58 deputados" }).click();
  await expect(page).toHaveURL(/\/partido\/ps\?ver=deputados$/);
  const tabs = page.getByRole("navigation", { name: "Secções do PS" });
  await expect(tabs.getByRole("link", { name: /Deputados/ })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("region", { name: "Deputados do PS" }).getByRole("listitem")).toHaveCount(58);

  await tabs.getByRole("link", { name: "Iniciativas" }).click();
  await expect(page).toHaveURL(/ver=iniciativas$/);
  await expect(page.getByRole("region", { name: "Iniciativas do PS" }).getByRole("listitem").first()).toBeVisible();

  await tabs.getByRole("link", { name: "Votações" }).click();
  await expect(page).toHaveURL(/ver=votacoes$/);
  const votes = page.getByRole("region", { name: "Votações do PS" });
  await expect(votes.getByRole("list", { name: "Votações do PS" }).getByRole("listitem")).toHaveCount(20);
  // The button turns at once; the filtered list comes after its own request, so wait for it before reading the rows.
  const filtered = page.waitForResponse(
    (response) => response.url().includes("/parties/ps/votes?") && response.url().includes("position=against"),
  );
  await votes.getByRole("button", { name: /^Contra/ }).click();
  await expect(votes.getByRole("button", { name: /^Contra/ })).toHaveAttribute("aria-pressed", "true");
  await filtered;
  await expect(votes.getByRole("list", { name: "Votações do PS" }).getByRole("listitem").first().getByText(CONTRA)).toBeVisible();
  for (const item of await votes.getByRole("list", { name: "Votações do PS" }).getByRole("listitem").all())
    await expect(item.getByText(CONTRA)).toBeVisible();
  await votes.getByRole("button", { name: /^Todas/ }).click();
  await votes.getByRole("button", { name: "Carregar mais 20" }).click();
  await expect(votes.getByRole("list", { name: "Votações do PS" }).getByRole("listitem")).toHaveCount(40);
});

test("party page without deputies has no Parliament tabs", async ({ page }) => {
  await page.goto("/partido/pctp-mrpp?ver=deputados");
  await expect(page.getByText("sem assento parlamentar")).toBeVisible();
  await expect(page.getByRole("navigation", { name: /Secções do/ })).toHaveCount(0);
});

test("elections: the map links each place one level down", async ({ page }) => {
  await page.goto("/eleicoes/legislativas-2025/LOCAL-500000");
  const map = page.getByRole("group", { name: /Mapa por distrito/ });
  await expect(map).toBeVisible();
  await map.getByRole("link", { name: /^Lisboa: / }).click();
  await expect(page).toHaveURL(/LOCAL-110000$/);
  await page
    .getByRole("group", { name: /Mapa por concelho/ })
    .getByRole("link", { name: /^Sintra: / })
    .click();
  await expect(page).toHaveURL(/LOCAL-111100$/);
  await expect(page.getByRole("heading", { level: 1, name: "Sintra" })).toBeVisible();
});

test("elections: add up seats in the simulator, and pick a circle on the schematic map", async ({ page }) => {
  await page.goto("/eleicoes/legislativas-2025");
  const lists = page.getByRole("group", { name: "Listas a somar" });
  // The winner starts selected.
  await expect(lists.getByRole("button", { pressed: true })).toHaveCount(1);
  await lists.getByRole("button", { name: /^PS/ }).click();
  await expect(page.getByText(/^AD \+ PS: \d+ mandatos · maioria absoluta$/)).toBeVisible();
  await page.getByRole("button", { name: "Limpar" }).click();
  await expect(lists.getByRole("button", { pressed: true })).toHaveCount(0);

  const circles = page.getByRole("group", { name: "Círculos eleitorais" });
  await circles.getByRole("button", { name: /Aveiro/ }).click();
  const panel = page.getByRole("region", { name: "Círculo selecionado" });
  await expect(panel.getByRole("heading", { name: "Aveiro" })).toBeVisible();
  await panel.getByRole("link", { name: /Ver concelhos de Aveiro/ }).click();
  await expect(page).toHaveURL(/LOCAL-010000$/);
});

test("history: from the menu to the timeline of governments, and on to the current government and an election", async ({
  page,
  isMobile,
}) => {
  test.setTimeout(60_000);
  await page.goto("/");
  if (isMobile) {
    await page.getByRole("button", { name: "Abrir menu" }).click();
    await page
      .getByRole("dialog")
      .getByRole("link", { name: /História/ })
      .click();
  } else {
    await page
      .getByRole("navigation", { name: "Secções" })
      .getByRole("link", { name: /História/ })
      .click();
  }
  await expect(page).toHaveURL(/\/historia$/);
  await expect(page.getByRole("heading", { level: 1, name: "Os governos da democracia" })).toBeVisible();
  await expect(page.getByText("governos desde 1974", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { level: 3, name: "Anos 1970" })).toBeVisible();

  // An animation runs from 1974 to today: it can be paused, moved with the slider, and skipped to the end.
  await page.getByRole("button", { name: "❚❚ Pausa" }).click();
  await page.getByRole("slider", { name: "Data na animação" }).fill(String(Math.round(Date.parse("1990-06-01") / 86_400_000)));
  await expect(page.getByRole("slider", { name: "Data na animação" })).toHaveAttribute("aria-valuetext", /de 1990$/);
  await page.getByRole("button", { name: "Saltar para o fim ⏭" }).click();
  // At the end it stays put: nothing left to skip, and it can start over.
  await expect(page.getByRole("button", { name: "Saltar para o fim ⏭" })).toBeDisabled();
  await page.getByRole("button", { name: "↺ Recomeçar" }).click();
  await expect(page.getByRole("button", { name: "Saltar para o fim ⏭" })).toBeEnabled();
  const chosen = page.getByRole("article", { name: "Henrique Valadares" }).first();
  await expect(chosen.getByText("Em funções")).toBeVisible();
  // Filters narrow the timeline.
  const all = await page.getByRole("region", { name: "Governo a governo" }).getByRole("article").count();
  await page.getByRole("button", { name: "Provisórios" }).click();
  await expect(page.getByRole("region", { name: "Governo a governo" }).getByRole("article")).not.toHaveCount(all);
  await page.getByRole("button", { name: "Todos" }).click();
  await expect(page.getByText("Teresa Albuquerque toma posse como Presidente da República")).toBeVisible();
  // On wide screens a rail beside the timeline jumps to a decade or a year.
  if (!isMobile) {
    await page
      .getByRole("navigation", { name: "Ir para" })
      .getByRole("link", { name: /^1974–79/ })
      .click();
    await expect(page.getByRole("heading", { level: 3, name: "Anos 1970" })).toBeInViewport();
  }
  // A kind of event the site doesn't know yet is left out; elections link to their results.
  await expect(page.getByText("Um tipo que o site ainda não conhece")).toHaveCount(0);
  await page
    .getByRole("region", { name: "Governo a governo" })
    .getByRole("link", { name: /^Legislativas 2025/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/eleicoes\/legislativas-2025$/);
  await page.goBack();
  await page.getByRole("link", { name: "Quem governa agora →" }).first().click();
  await expect(page).toHaveURL(/\/governo$/);
});

test("blog: featured posts on the front page, the list by kind, and a post rendered safely", async ({ page }) => {
  await page.goto("/");
  // One post from the blog in a box beside the news (before it on smaller screens).
  const spotlight = page.locator("section:visible", { has: page.getByText("Destaque · Blog") });
  await expect(spotlight).toHaveCount(1);
  await spotlight.getByRole("heading").getByRole("link").click();
  await expect(page).toHaveURL(/\/editorial\/[a-z0-9-]+$/);
  await page.goto("/editorial/a-maioria-que-nao-existe");
  await expect(page.getByRole("heading", { level: 1, name: "A maioria que não existe" })).toBeVisible();
  await expect(page.getByText(/Texto de opinião: vincula apenas Tomás Varela/)).toBeVisible();
  // Raw HTML shows as text, a script link stays plain text, and a player from an unknown host is dropped.
  await expect(page.getByText("<script>window.__xssPost=1</script>", { exact: false })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __xssPost?: number }).__xssPost)).toBeUndefined();
  await expect(page.getByRole("link", { name: "um link perigoso" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "um bom" })).toHaveAttribute("href", "https://www.parlamento.pt");
  await expect(page.locator("iframe")).toHaveCount(0);
  const ld = JSON.parse((await page.locator('main script[type="application/ld+json"]').textContent())!);
  expect(ld).toMatchObject({ "@type": "OpinionNewsArticle", headline: "A maioria que não existe" });

  // A long explainer: its sections listed and numbered, each a jump to its heading.
  await page.goto("/editorial/como-se-chega-a-deputado");
  const contents = page.getByRole("navigation", { name: "Neste artigo" }).filter({ visible: true });
  await contents.getByRole("link", { name: /Os 22 círculos/ }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Os 22 círculos" })).toBeInViewport();

  // The blog reads like the news: a toolbar, formats with counts, posts by day.
  await page.goto("/editorial");
  const formats = page.getByRole("list", { name: "Formato" });
  await expect(formats.getByRole("link", { name: /^Tudo/ })).toHaveAttribute("aria-current", "true");
  const blogSearch = page.getByRole("button", { name: "Procurar no blog" });
  if (await blogSearch.isVisible()) await blogSearch.click();
  await page.getByRole("searchbox", { name: "Procurar no blog" }).fill("orçamento");
  await page.getByRole("searchbox", { name: "Procurar no blog" }).press("Enter");
  await expect(page).toHaveURL(/q=or%C3%A7amento/);
  await expect(page.getByText(/publicaç(ão|ões)/).first()).toBeVisible();
  await expect(page.getByRole("article").first()).toContainText(/Orçamento/i);
  await page.goto("/editorial?tipo=podcast");
  await expect(page.getByRole("list", { name: "Formato" }).getByRole("link", { name: /^Podcasts/ })).toHaveAttribute(
    "aria-current",
    "true",
  );
  await expect(page.getByRole("article")).toHaveCount(1);
  await page.getByRole("link", { name: "Orçamento do Estado: o que muda?" }).click();
  // Nothing from Spotify until the reader asks; "always" is remembered and can be undone on the cookies page.
  const player = page.locator('iframe[src^="https://open.spotify.com/embed/"]');
  await expect(player).toHaveCount(0);
  await page.getByRole("button", { name: "Carregar sempre" }).click();
  await expect(player).toBeVisible();
  await page.reload();
  await expect(player).toBeVisible();
  await page.goto("/cookies");
  await page.getByRole("button", { name: /Deixar de carregar/ }).click();
  await page.goBack();
  await expect(page.getByRole("button", { name: "Carregar o Spotify" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Neste episódio" })).toBeVisible();

  expect((await page.goto("/editorial/nao-existe"))!.status()).toBe(404);
});

test("legislatures: the list, one opened with its chamber, governments, events by kind with sources, and its neighbours", async ({
  page,
}) => {
  await page.goto("/legislaturas");
  await page.getByRole("link", { name: /XVII Legislatura/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "XVII Legislatura" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Lugares eleitos em Legislativas 2025" })).toContainText("UDP 10");
  await expect(page.getByRole("link", { name: "Legislativas 2025 →" })).toHaveAttribute("href", "/eleicoes/legislativas-2025");
  await expect(page.getByRole("complementary", { name: "Quem governou" })).toContainText("Henrique Valadares");
  // Only the month is known: no day is made up.
  await expect(page.getByText("setembro de 2025", { exact: true })).toBeVisible();
  // A judicial case keeps its whole summary, and its sources are links.
  await expect(page.getByText("Em novembro de 2025 havia dois arguidos e nenhuma acusação.")).toBeVisible();
  await expect(page.getByRole("link", { name: /Rádio Exemplo/ })).toHaveAttribute("href", "https://example.org/caso");
  await page
    .getByRole("group", { name: "Mostrar" })
    .getByRole("button", { name: /Polémicas/ })
    .click();
  await expect(page.getByRole("heading", { level: 3, name: "Lei fictícia da habitação aprovada" })).toHaveCount(0);
  await expect(page.getByText("ainda por decidir")).toBeVisible();
  // An older one: the record is said to be incomplete, and undecided initiatives lapsed.
  await page.getByRole("link", { name: /Anterior/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "III Legislatura" })).toBeVisible();
  await expect(page.getByText(/Registo incompleto nos dados abertos do Parlamento/)).toBeVisible();
  await expect(page.getByText("caducaram no fim")).toBeVisible();
  await expect(page.getByText("1984", { exact: true })).toBeVisible();
  expect((await page.goto("/legislaturas/XCIX"))!.status()).toBe(404);
});

test("history: a government opens what happened in its legislature", async ({ page }) => {
  await page.goto("/historia");
  const skip = page.getByRole("button", { name: "Saltar para o fim ⏭" });
  if (await skip.isEnabled()) await skip.click();
  const mandate = page.getByRole("list", { name: "O que aconteceu no mandato de Henrique Valadares" });
  await expect(mandate).toContainText("2 acontecimentos");
  await mandate.getByRole("link", { name: /O que aconteceu · XVII Legislatura/ }).click();
  await expect(page).toHaveURL(/\/legislaturas\/XVII#aconteceu$/);
  await expect(page.getByRole("heading", { level: 2, name: "O que aconteceu" })).toBeVisible();
});

test("agenda: what is coming by day, filters, how to attend, add to calendar, and the next event on the front page", async ({
  page,
  isMobile,
}) => {
  await page.goto("/");
  const box = page.getByRole("region", { name: "Debate quinzenal com o Primeiro-Ministro" }).filter({ visible: true });
  await expect(box).toContainText("Próximo evento");
  await expect(box).toContainText("Amanhã");
  // In the feed on every screen; the side column leaves it out.
  if (!isMobile) await expect(page.getByRole("complementary", { name: "Ao lado das notícias" })).not.toContainText("Próximo evento");
  await box.getByRole("link", { name: /^(Ver a agenda|Agenda)/ }).click();
  await expect(page).toHaveURL(/\/agenda$/);
  await expect(page.getByRole("heading", { level: 1, name: "Agenda política" })).toBeVisible();
  await expect(page.getByText("4 eventos")).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: /^Amanhã · / })).toBeVisible();
  const debate = page.getByRole("article", { name: "Debate quinzenal com o Primeiro-Ministro" });
  await expect(debate).toContainText("Aberto ao público");
  await expect(debate.getByRole("link", { name: /Assembleia da República, Palácio de São Bento/ })).toHaveAttribute(
    "href",
    /openstreetmap/,
  );
  await expect(debate.getByRole("link", { name: /Ver em direto · Canal Parlamento/ })).toBeVisible();
  // A cancelled event says so, and can't be added to a calendar.
  const cancelled = page.getByRole("article", { name: "Conselho de Ministros" });
  await expect(cancelled).toContainText("Cancelado");
  await expect(cancelled.getByRole("button", { name: /Adicionar ao calendário/ })).toHaveCount(0);
  if (!isMobile) {
    const download = page.waitForEvent("download");
    await debate.getByRole("button", { name: /Adicionar ao calendário/ }).click();
    expect((await download).suggestedFilename()).toBe("plenario-1.ics");
  }
  // Filters: a kind, then a district and only what is open to the public.
  await page.getByRole("list", { name: "Tipo" }).getByRole("link", { name: "Partidos" }).click();
  await expect(page).toHaveURL(/tipo=party/);
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(page.getByRole("article", { name: "Congresso Nacional do PS" })).toContainText(/Até /);
  await page.goto("/agenda");
  await page.getByRole("combobox", { name: "Distrito" }).selectOption("Porto");
  await page.getByRole("checkbox", { name: "Só abertos ao público" }).check();
  await page.getByRole("button", { name: "Aplicar" }).click();
  await expect(page).toHaveURL(/distrito=Porto&aberto=1/);
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(page.getByRole("article", { name: "Reunião pública da Câmara Municipal do Porto" })).toContainText(
    "Inscrição prévia para intervir",
  );
});

test("feedback: report an error with the right fact, a source and a screenshot, ask for an answer, and see the log", async ({ page }) => {
  // Old links with the page filled in land on the private error form.
  await page.goto("/feedback?pagina=Percursos&ligacao=/percursos");
  await expect(page).toHaveURL(/\/feedback\/nova\?tipo=erro/);
  await expect(page.getByRole("heading", { level: 1, name: "Reportar um erro" })).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "O que queres enviar?" }).getByRole("link", { name: /Erro nos dados/ }),
  ).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("combobox", { name: "Em que página?" })).toHaveValue("Percursos");
  await expect(page.getByRole("textbox", { name: /Ligação/ })).toHaveValue("/percursos");
  // Without the message, it asks for it.
  await page.getByRole("button", { name: "Enviar feedback →" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "O que está errado?" })).toBeVisible();
  await page.getByRole("textbox", { name: "O que está errado?" }).fill("Falta o cargo de Presidente da Assembleia.");
  await expect(page.getByText(/^[1-9]\d* \/ 1000$/)).toBeVisible();
  await page.getByRole("textbox", { name: "Qual é a informação certa?" }).fill("Presidente da Assembleia desde 2024");
  await page.getByRole("textbox", { name: /Onde se confirma/ }).fill("parlamento.pt");
  await page
    .locator('input[type="file"]')
    .setInputFiles({ name: "erro.png", mimeType: "image/png", buffer: Buffer.from("89504e47", "hex") });
  await expect(page.getByText("erro.png")).toBeVisible();
  await page.getByRole("radio", { name: "Quero ser avisado" }).click();
  await page.getByRole("textbox", { name: "O teu email" }).fill("nao-e-email");
  await page.getByLabel("Não sou um robô (teste)").check();
  await page.getByRole("button", { name: "Enviar feedback →" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "email válido" })).toBeVisible();
  await page.getByRole("textbox", { name: "O teu email" }).fill("leitor@example.com");
  await page.getByRole("button", { name: "Enviar feedback →" }).click();
  await expect(page.getByRole("status")).toContainText("Obrigado. Recebemos a tua mensagem.");

  // «Algo não funciona» is the same private form, without the right fact and source.
  await page.goto("/feedback/nova?tipo=falha");
  await expect(page.getByRole("heading", { level: 1, name: "Algo não funciona" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "O que acontece?" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Qual é a informação certa?" })).toHaveCount(0);
  await expect(page.getByText("38", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Ver tudo" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Registo de correções" })).toBeVisible();
  await expect(page.getByText("Não confirmado")).toBeVisible();
});

test("feedback: every page's footer opens the form with that page filled in, and the menu lists it", async ({ page, isMobile }) => {
  await page.goto("/partidos");
  await page.getByRole("contentinfo").getByRole("link", { name: "Diz-nos →" }).click();
  await expect(page).toHaveURL(/\/feedback\/nova\?tipo=erro/);
  await expect(page.getByRole("combobox", { name: "Em que página?" })).toHaveValue("Partidos");
  await expect(page.getByRole("textbox", { name: /Ligação/ })).toHaveValue("/partidos");
  if (!isMobile) {
    await expect(page.getByRole("navigation", { name: "Secções" }).getByRole("link", { name: /Feedback/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
  }
});

test("news: opening an article counts one read, sent by the browser, and the card shows the reads", async ({ page }) => {
  test.skip(FEATURES.stories, "Articles feed: with stories, see the stories test.");
  const read = page.waitForRequest((request) => /\/articles\/98\/view$/.test(request.url()) && request.method() === "POST");
  await page.goto("/article/98");
  await read;
  // Once per visit: coming back to the same article sends nothing more.
  let again = false;
  page.on("request", (request) => {
    if (/\/articles\/98\/view$/.test(request.url())) again = true;
  });
  await page.reload();
  await page.waitForLoadState("load");
  // The read would go right after the page shows; a moment is enough (networkidle never settles under a busy server).
  await page.waitForTimeout(1500);
  expect(again).toBe(false);

  await page.goto("/");
  // Other tests read article 100 too, so only the shape of the count is checked.
  await expect(
    page
      .locator("main article")
      .filter({ hasText: "Notícia de teste número 100" })
      .getByText(/^1\s?2\d\d leituras$/),
  ).toBeVisible();
});

test("news: readers vote up or down, take the vote back, and sort by the most voted", async ({ page }) => {
  await signUp(page);
  test.skip(FEATURES.stories, "Articles feed: with stories, see the stories test.");
  await gotoReady(page, "/?ordem=votadas&periodo=hoje");
  const first = page.locator("main article").first();
  await expect(first).toContainText("Notícia de teste número 98");
  const score = first.getByLabel(/^Pontuação:/);
  const before = Number((await score.getAttribute("aria-label"))!.replace(/\D/g, ""));
  const up = first.getByRole("button", { name: /^Votar a favor de/ });
  await up.click();
  await expect(up).toHaveAttribute("aria-pressed", "true");
  await expect(score).toHaveAttribute("aria-label", `Pontuação: ${before + 1}`);
  // Down replaces up; pressing it again takes the vote back.
  const down = first.getByRole("button", { name: /^Votar contra/ });
  await down.click();
  await expect(score).toHaveAttribute("aria-label", `Pontuação: ${before - 1}`);
  await down.click();
  await expect(down).toHaveAttribute("aria-pressed", "false");
  await expect(score).toHaveAttribute("aria-label", `Pontuação: ${before}`);

  await page.goto("/?ordem=polemicas");
  await expect(page.locator("main article").first()).toContainText("Notícia de teste número 97");
  await expect(page.getByText(/as mais polémicas dos últimos 7 dias primeiro/)).toBeVisible();
});

test("stories: one card per news told by several outlets, Importa, Hoje em 5, every version and one debate", async ({ page }) => {
  test.skip(!FEATURES.stories, "Stories are switched off in lib/features.ts.");
  // Importa needs an account.
  await signUp(page);
  await page.goto("/");
  const card = page
    .locator("main article")
    .filter({ has: page.getByRole("link", { name: "Notícia de teste número 100: Parlamento debate o orçamento & a saúde", exact: true }) })
    .first();
  await expect(card).toContainText("+3 jornais");
  // No photo from the outlet it names: a light branded frame of the same size, with the outlet, instead of the card shrinking.
  const noImage = card.locator("[data-no-image]");
  await expect(noImage).toBeVisible();
  await expect(noImage).toContainText("OLITICANDO");
  await expect(card.getByText(/Sem imagem/i)).toHaveCount(0);
  // How each outlet headlined it, folded under the logos.
  await card.getByText("4 jornais contaram isto").click();
  await expect(card.getByRole("link", { name: /Notícia de teste número 85/ })).toBeVisible();
  // Each outlet with when it published, first to publish first: who reported first, and when.
  const told = card.locator("details ol > li");
  // As on the article page: «26-11-2026 | 10:06», and «Ler ↗» to the outlet's own site.
  await expect(told).toHaveCount(4);
  await expect(told.first()).toContainText(/\d{2}-\d{2}-\d{4} \| \d{2}:\d{2}/);
  await expect(told.first().locator("time").first()).toHaveAttribute("datetime", /^\d{4}-\d{2}-\d{2}T/);
  await expect(told.first().getByRole("link", { name: /^Ler em .+ \(abre num novo separador\)$/ })).toHaveAttribute(
    "href",
    /^https:\/\/example\.com\/noticia\/\d+$/,
  );
  // Importa: one mark, taken back by pressing again.
  const importa = card.getByRole("button", { name: /^Importa/ });
  await expect(importa).toHaveAttribute("aria-pressed", "false");
  const answered = page.waitForResponse((response) => /\/stories\/100\/vote$/.test(response.url()));
  await importa.click();
  await answered;
  await expect(importa).toHaveAttribute("aria-pressed", "true");
  const marked = Number((await importa.textContent())!.match(/\d+/)![0]);
  // Hoje em 5: the story opened gets its tick.
  const today = page.getByRole("region", { name: /^Hoje em/ }).filter({ visible: true });
  await expect(today).toContainText("0 de 5");
  // How fresh each one is: the outlets of the last 24 hours and the latest article's age.
  await expect(today.getByRole("listitem").first()).toContainText(/\d+ jorna(l|is) · /);
  await noSeriousA11yIssues(page);

  // The card's title (the outlet's own row, opened above, has the same headline).
  await card
    .getByRole("link", { name: "Notícia de teste número 100: Parlamento debate o orçamento & a saúde", exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(/\/article\/100$/);
  await expect(page.getByText("4 jornais nesta história")).toBeVisible();
  const versions = page.getByRole("navigation", { name: "Versões desta notícia" });
  await expect(versions.locator("a[aria-current=page]")).toHaveCount(1);
  // One chip per outlet; Expresso's later piece is under the headline, newest, and in «Desenvolvimentos».
  await expect(versions.getByRole("listitem")).toHaveCount(4);
  const updated = page.getByText(/^Atualizado (às|a) /);
  await expect(updated.getByRole("link", { name: /Notícia de teste número 94/ })).toHaveAttribute("href", "/article/94");
  const developments = page.getByRole("region", { name: "Desenvolvimentos" });
  await expect(developments.getByRole("listitem")).toHaveCount(1);
  await expect(developments.getByRole("link", { name: /Notícia de teste número 94/ })).toHaveAttribute("href", "/article/94");
  await expect(page.getByRole("heading", { level: 2, name: "Como cada jornal contou" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: /^Debate/ })).toBeVisible();
  await expect(page.locator("figcaption", { hasText: "A favor" })).toBeVisible();
  await expect(page.locator("figcaption", { hasText: "Contra" })).toBeVisible();
  // The mark carries over, and the story's count follows it, even if the page was cached before the mark.
  const storyImporta = page.getByRole("button", { name: /^Importa/ });
  await expect(storyImporta).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#importa, #importa-topo").filter({ visible: true })).toHaveText(String(marked));
  // Contexto: our post that explains it, the party's votes, what's coming.
  const context = page.getByRole("region", { name: /^Contexto/ });
  await expect(context).toContainText("#OE2027");
  await expect(context.getByRole("link", { name: "O que muda no Orçamento" })).toHaveAttribute(
    "href",
    "/editorial/o-que-muda-no-orcamento",
  );
  await expect(context).toContainText("Votação final global do OE2027");
  // Likes on the debate's comments, taken back by pressing again.
  const like = page.getByRole("button", { name: /gostos no comentário de rita/ });
  const before = Number((await like.textContent())!.match(/\d+/)![0]);
  const likedAnswer = page.waitForResponse((response) => /\/comments\/9001\/like$/.test(response.url()));
  await like.click();
  await likedAnswer;
  await expect(like).toHaveAttribute("aria-pressed", "true");
  await expect(like).toContainText(String(before + 1));
  await expect(page.getByText("Concorda", { exact: true }).first()).toBeVisible();
  // The story is about a proposal: the form offers a side, optional.
  await page.getByRole("button", { name: "Junta-te à conversa…" }).click();
  const side = page.getByRole("group", { name: "A tua posição (opcional)" });
  await side.getByRole("button", { name: "Discordo" }).click();
  await expect(side.getByRole("button", { name: "Discordo" })).toHaveAttribute("aria-pressed", "true");
  await noSeriousA11yIssues(page);

  // Another outlet's version: the same story, the same debate.
  await versions.getByRole("link", { name: /Expresso/ }).click();
  await expect(page).toHaveURL(/\/article\/90$/);
  await expect(page.locator("figcaption", { hasText: "A favor" })).toBeVisible();
  // The same Importa, and it can be taken back there.
  await expect(storyImporta).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#importa, #importa-topo").filter({ visible: true })).toHaveText(String(marked));
  const takenBack = page.waitForResponse((response) => /\/stories\/100\/vote$/.test(response.url()));
  await storyImporta.click();
  await takenBack;
  await expect(storyImporta).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("#importa, #importa-topo").filter({ visible: true })).toHaveText(String(marked - 1));
  await page.goto("/");
  await expect(page.getByRole("region", { name: /^Hoje em/ }).filter({ visible: true })).toContainText(/[12] de 5/);
});

test("news menu: save, hide with undo, why, and report", async ({ page }) => {
  await signUp(page);
  await gotoReady(page, "/");
  const card = page.locator("main article").filter({ hasText: "Notícia de teste número 98" });
  const menu = () => card.getByRole("button", { name: /^Mais opções para/ });

  // Saved: on the Guardadas page, kept by the account.
  await menu().click();
  await card.getByRole("button", { name: "Guardar", exact: true }).click();
  await menu().click();
  await expect(card.getByRole("button", { name: "Tirar das guardadas" })).toHaveAttribute("aria-pressed", "true");
  await card.getByRole("button", { name: "Porque vejo isto?" }).click();
  await expect(card.getByText(/Aparece porque está entre as notícias mais recentes/)).toBeVisible();
  await page.keyboard.press("Escape");

  // Hidden, then brought back.
  await menu().click();
  await card.getByRole("button", { name: "Esconder" }).click();
  await expect(card).toHaveCount(0);
  await page.getByRole("button", { name: "Desfazer" }).click();
  await expect(card).toHaveCount(1);

  // Reported, with the reasons for news.
  await menu().click();
  await card.getByRole("button", { name: "Denunciar" }).click();
  await card.getByRole("radio", { name: "Link não funciona" }).check();
  await card.getByRole("button", { name: "Enviar denúncia" }).click();
  await expect(card.getByRole("status")).toContainText("Obrigado");

  await page.goto("/guardadas");
  await expect(page.locator("main article").filter({ hasText: "Notícia de teste número 98" })).toBeVisible();
  await noSeriousA11yIssues(page);
});

test('blog: readers mark a post "Importa", in the list and on its page', async ({ page }) => {
  await signUp(page);
  await page.goto("/editorial");
  const row = page.locator("main article").filter({ hasText: "A maioria que não existe" });
  const importa = row.getByRole("button", { name: /dizem que «A maioria que não existe» importa/ });
  // One mark, no down-vote.
  await expect(row.getByRole("button", { name: /^Votar contra/ })).toHaveCount(0);
  const count = async (button: typeof importa) => Number((await button.innerText()).replace(/\D/g, ""));
  // The count the API answers with (the page itself may come from a cache).
  const vote = () => page.waitForResponse((response) => /\/editorial\/a-maioria-que-nao-existe\/vote$/.test(response.url()));
  const marked = vote();
  await importa.click();
  const { importa: after } = (await (await marked).json()) as { importa: number };
  await expect(importa).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => count(importa)).toBe(after);
  // Kept by the account: the post's page shows the same mark, and pressing again takes it back.
  await page.goto("/editorial/a-maioria-que-nao-existe");
  const onPage = page.getByRole("button", { name: /dizem que «A maioria que não existe» importa/ });
  await expect(onPage).toHaveAttribute("aria-pressed", "true");
  const unmarked = vote();
  await onPage.click();
  await unmarked;
  await expect(onPage).toHaveAttribute("aria-pressed", "false");
  await expect.poll(() => count(onPage)).toBe(after - 1);
  await noSeriousA11yIssues(page);
});

test("blog: readers comment on a post as on the news", async ({ page }, testInfo) => {
  await signUp(page);
  const text = `Comentário de teste no blog (${testInfo.project.name})`;
  await gotoReady(page, "/editorial/o-que-muda-no-orcamento");
  const section = page.getByRole("region", { name: /Comentários/ });
  await expect(section.getByText("Bem explicado, obrigado.")).toBeVisible();
  await section.getByRole("button", { name: "Junta-te à conversa…" }).click();
  await section.getByRole("textbox", { name: "Comentário", exact: true }).fill(text);
  await section.getByRole("button", { name: "Publicar" }).click();
  await expect(section.getByText(text)).toBeVisible();
  // A post written in the code has no comments in the API: no box.
  await page.goto("/editorial/como-se-chega-a-deputado");
  await expect(page.getByRole("region", { name: /Comentários/ })).toHaveCount(0);
});

test("SEO: share images, structured data, icons and robots", async ({ page, request }) => {
  await page.goto("/partido/ps");
  const image = await page.locator('meta[property="og:image"]').getAttribute("content");
  expect(image).toMatch(/\/partido\/ps\/opengraph-image/);
  const png = await request.get(new URL(image!).pathname + new URL(image!).search);
  expect(png.status()).toBe(200);
  expect(png.headers()["content-type"]).toBe("image/png");
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");
  await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute("content", "Politicando");
  const types = (await page.locator('script[type="application/ld+json"]').allTextContents())
    .flatMap((text) => [JSON.parse(text)].flat())
    .map((item: { "@type": string }) => item["@type"]);
  expect(types).toEqual(expect.arrayContaining(["Organization", "WebSite", "PoliticalParty", "BreadcrumbList"]));

  // Every page has a share image, the site's own when it has none.
  await page.goto("/parlamento");
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /\/opengraph-image/);
  expect((await request.get("/icon")).status()).toBe(200);
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain("Disallow: /admin");
  // Bing and the SEO crawlers are slowed (Google ignores Crawl-delay), with the same disallowed paths.
  const bing = robots.slice(robots.indexOf("User-Agent: bingbot"));
  expect(bing).toContain("Crawl-delay: 5");
  expect(bing).toContain("Disallow: /admin");
  expect(await (await request.get("/sitemap.xml")).text()).toContain("/forum</loc>");
});

test("feed view: cards or a compact list, remembered; the order tabs", async ({ page }) => {
  // Importa (from the list, with stories on) needs an account.
  await signUp(page);
  await gotoReady(page, "/");
  const choose = async (name: string) => {
    const group = page.getByRole("group", { name: "Vista das notícias" });
    // A click before the page is interactive does nothing: press again until the menu opens.
    await expect(async () => {
      if (!(await group.isVisible())) await page.getByRole("button", { name: /^Vista das notícias/ }).click();
      await expect(group).toBeVisible({ timeout: 1000 });
    }).toPass();
    await group.getByRole("button", { name }).click();
  };
  await expect(page.getByRole("button", { name: /^Vista das notícias/ })).toContainText("Cartões");
  await choose("Lista compacta");
  await expect(page.getByRole("button", { name: /^Vista das notícias/ })).toContainText("Lista compacta");
  await noSeriousA11yIssues(page);
  // Kept after a reload, drawn by the server from the first paint.
  await page.reload();
  await expect(page.getByRole("button", { name: /^Vista das notícias/ })).toContainText("Lista compacta");
  if (FEATURES.stories) {
    // Importa works from the list too.
    const importa = page.getByRole("button", { name: /Importa: leitores dizem que «Notícia de teste número 100:/ });
    const pressed = await importa.getAttribute("aria-pressed");
    const answered = page.waitForResponse((response) => /\/stories\/100\/vote$/.test(response.url()));
    await importa.click();
    await answered;
    await expect(importa).toHaveAttribute("aria-pressed", pressed === "true" ? "false" : "true");
    // The debate pair shows on the cards, not in the list.
    await expect(page.locator("main figcaption", { hasText: "A favor" })).toHaveCount(0);
    await choose("Cartões");
    await expect(page.locator("main figcaption", { hasText: "A favor" }).first()).toBeVisible();
  }
  // "Recentes" is the first tab; the line above the feed appears only for another order.
  const tabs = page.getByRole("group", { name: "Ordenar notícias" });
  await expect(tabs.getByRole("button", { name: "Recentes" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText(/mais recentes primeiro/i)).toHaveCount(0);
  await tabs.getByRole("button").nth(1).click();
  await expect(page).toHaveURL(/ordem=/);
  await expect(page.getByText(/primeiro$/i).first()).toBeVisible();
  await tabs.getByRole("button", { name: "Recentes" }).click();
  await expect(page).not.toHaveURL(/ordem=/);
});

test("the podcast box: the newest episode without Spotify, which loads and plays on ▶; also at the end of the blog", async ({
  page,
  isMobile,
}) => {
  // Spotify is never contacted. Its iFrame API is replaced by a stand-in that records what the box asks of it.
  await page.route(/open\.spotify\.com/, (route) =>
    route.request().url().includes("/embed/iframe-api/")
      ? route.fulfill({
          contentType: "text/javascript",
          body: `window.onSpotifyIframeApiReady({ createController(element, options, done) {
            const [, kind, id] = options.uri.split(":");
            const frame = document.createElement("iframe");
            frame.src = "https://open.spotify.com/embed/" + kind + "/" + id;
            element.replaceWith(frame);
            done({ addListener(event, callback) { if (event === "ready") callback(); }, play() { window.__spotifyPlay = true; } });
          } });`,
        })
      : route.fulfill({ status: 200, contentType: "text/html", body: "<p>leitor</p>" }),
  );
  await page.goto("/");
  const box = page.getByRole("region", { name: /^O dia de ontem na política/ }).filter({ visible: true });
  if (isMobile) await box.scrollIntoViewIfNeeded();
  // The episode comes from our server: title, number, date and length, and no player yet.
  // The date Spotify puts in front of the title goes on the line below, so the title has the room.
  await expect(box.getByText("O Orçamento na reta final, explicado", { exact: true })).toBeVisible();
  await expect(box.getByText("18 nov · 24 min", { exact: true })).toBeVisible();
  await expect(box.locator("iframe")).toHaveCount(0);
  // "Abrir no Spotify" goes to the episode itself.
  await expect(box.getByRole("link", { name: /Abrir no Spotify/ })).toHaveAttribute(
    "href",
    "https://open.spotify.com/episode/0000000000TesteEpis03",
  );
  await noSeriousA11yIssues(page);

  await box.getByRole("button", { name: /^Ouvir aqui: O Orçamento na reta final/ }).click();
  await expect(box.locator("iframe")).toHaveAttribute("src", "https://open.spotify.com/embed/episode/0000000000TesteEpis03");
  await expect.poll(() => page.evaluate(() => (window as unknown as { __spotifyPlay?: boolean }).__spotifyPlay)).toBe(true);

  await page.goto("/editorial");
  const end = page.getByRole("region", { name: /^O dia de ontem na política/ });
  await expect(end.getByRole("button", { name: /^Ouvir aqui: O Orçamento na reta final/ })).toBeVisible();
  await expect(end.getByRole("link", { name: /Abrir no Spotify/ })).toBeVisible();
});

test("the blog's Podcasts filter lists the earlier episodes, each playing on ▶; only that filter", async ({ page }) => {
  // Spotify is never contacted: its player is a stand-in page.
  await page.route(/open\.spotify\.com/, (route) =>
    route.request().url().includes("/embed/iframe-api/")
      ? route.abort()
      : route.fulfill({ status: 200, contentType: "text/html", body: "<p>leitor</p>" }),
  );
  await page.goto("/editorial?tipo=podcast");
  const list = page.getByRole("region", { name: "Episódios anteriores" });
  await list.scrollIntoViewIfNeeded();
  // The newest is in the box above: the three before it, newest first, with the date below each title.
  const rows = list.getByRole("listitem");
  await expect(rows).toHaveCount(3);
  await expect(rows.first()).toContainText("A semana no Parlamento começa com a saúde");
  await expect(rows.first()).toContainText("17 nov · 6 min");
  await expect(rows.first()).not.toContainText("17 nov. ·");
  await expect(list.locator("iframe")).toHaveCount(0);
  await expect(list.getByRole("link", { name: /Ver todos no Spotify/ })).toHaveAttribute(
    "href",
    "https://open.spotify.com/show/6qMcWa60jvf3CqsSZtzPtT",
  );
  await noSeriousA11yIssues(page);

  // ▶ loads Spotify's player on that episode only.
  await rows
    .nth(1)
    .getByRole("button", { name: /^Ouvir aqui: O que o Governo aprovou/ })
    .click();
  await expect(list.locator("iframe")).toHaveCount(1);
  await expect(list.locator("iframe")).toHaveAttribute("src", /\/embed\/episode\/0000000000TesteEpis01/);

  await page.goto("/editorial");
  await expect(page.getByRole("region", { name: "Episódios anteriores" })).toHaveCount(0);
});

test("our profiles: X and the podcast in the footer and the menu, and in the site's structured data", async ({ page, isMobile }) => {
  await page.goto("/parlamento");
  const footer = page.locator("footer");
  await expect(footer.getByRole("link", { name: /@politicando_pt no X/ })).toHaveAttribute("href", "https://x.com/politicando_pt");
  await expect(footer.getByRole("link", { name: /@politicando\.pt no Instagram/ })).toHaveAttribute(
    "href",
    "https://www.instagram.com/politicando.pt/",
  );
  await expect(footer.getByRole("link", { name: /@politicando\.pt no Threads/ })).toHaveAttribute(
    "href",
    "https://www.threads.com/@politicando.pt",
  );
  await expect(footer.getByRole("link", { name: /@politicandopt no TikTok/ })).toHaveAttribute(
    "href",
    "https://www.tiktok.com/@politicandopt",
  );
  await expect(footer.getByRole("link", { name: /Podcast no Spotify/ })).toHaveAttribute(
    "href",
    "https://open.spotify.com/show/6qMcWa60jvf3CqsSZtzPtT",
  );
  if (isMobile) {
    await page.getByRole("button", { name: "Abrir menu" }).click();
    await expect(page.locator("dialog[open]").getByRole("link", { name: /@politicando_pt no X/ })).toBeVisible();
  } else {
    await expect(page.getByRole("navigation", { name: "Secções" }).getByRole("link", { name: /@politicando_pt no X/ })).toBeVisible();
  }
  await expect(page.locator('meta[name="twitter:site"]')).toHaveAttribute("content", "@politicando_pt");
  const site = await page.locator('script[type="application/ld+json"]').allTextContents();
  expect(site.join("")).toContain(
    '"sameAs":["https://x.com/politicando_pt","https://www.instagram.com/politicando.pt/","https://www.tiktok.com/@politicandopt","https://www.threads.com/@politicando.pt","https://open.spotify.com/show/6qMcWa60jvf3CqsSZtzPtT"]',
  );
});

test("a card without a photo keeps its shape, with a branded frame naming the outlet", async ({ page }) => {
  test.skip(FEATURES.stories, "With stories on, the stories test covers it.");
  await page.goto("/");
  const card = page.locator("main article").first();
  const frame = card.locator("[data-no-image]");
  await expect(frame).toBeVisible();
  await expect(frame).toContainText("OLITICANDO");
  await expect(card.getByText(/Sem imagem/i)).toHaveCount(0);
  const box = await frame.locator("xpath=ancestor::a[1]").boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(180);
});

test("follow us: rarely in the feed until dismissed, at the side column's end, in the footer and on /sobre", async ({ page, isMobile }) => {
  await page.goto("/");
  const card = page.getByRole("region", { name: /As notícias de hoje, explicadas em 60 segundos/ });
  await expect(card).toBeVisible();
  await expect(card.getByRole("link", { name: /@politicandopt no TikTok/ })).toHaveAttribute(
    "href",
    "https://www.tiktok.com/@politicandopt",
  );
  await noSeriousA11yIssues(page);
  await card.getByRole("button", { name: "Dispensar" }).click();
  await expect(card).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("region", { name: /As notícias de hoje, explicadas em 60 segundos/ })).toHaveCount(0);

  if (!isMobile) {
    const side = page.getByRole("complementary", { name: "Ao lado das notícias" });
    await expect(side.getByRole("link", { name: "Fontes", exact: true })).toHaveAttribute("href", "/sobre#fontes");
  }

  const footer = page.locator("footer");
  await expect(footer.getByRole("heading", { name: "A semana política, num só email." })).toBeVisible();
  await expect(footer.getByRole("link", { name: "Registo de correções" })).toHaveAttribute("href", "/feedback/correcoes");
  await expect(footer.getByRole("link", { name: /Voltar ao topo/ })).toBeVisible();

  // Not after articles any more.
  await page.goto("/article/100");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("region", { name: "Queres mais histórias assim?" })).toHaveCount(0);

  await page.goto("/sobre");
  await expect(page.getByRole("heading", { level: 2, name: "Fontes e método" })).toHaveAttribute("id", "fontes");
  await noSeriousA11yIssues(page);
});

test("an article says what kind it is, in gray under the outlet: news, opinion or a podcast", async ({ page }) => {
  await page.goto("/article/93");
  await expect(page.getByText("Opinião", { exact: true })).toBeVisible();
  await page.goto("/article/100");
  await expect(page.getByText("Notícia", { exact: true })).toBeVisible();
  // In the feed too.
  await gotoReady(page, "/");
  const podcast = page.locator("main article").filter({ hasText: "Notícia de teste número 92" });
  await expect(podcast.getByText("Podcast", { exact: true })).toBeVisible();
  await noSeriousA11yIssues(page);
});
