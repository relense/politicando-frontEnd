import { expect, test } from "@playwright/test";
import { noSeriousA11yIssues } from "./helpers";

test("feed loads more on scroll and reaches the end", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("article")).toHaveCount(10);
  for (let i = 0; i < 6 && !(await page.getByText("Não há mais notícias.").isVisible()); i++) {
    await page.mouse.wheel(0, 100_000);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(300);
  }
  await expect(page.getByText("Não há mais notícias.")).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(35);
});

test("hostile title stays harmless text", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: /<script>window.__xss/ })).toBeVisible();
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
  await page.goto("/partido/be");
  await page.getByRole("link", { name: "POLITICANDO" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Últimas notícias" })).toBeVisible();
  await expect(page.getByRole("article").first()).toContainText("número 100");
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(page.getByRole("article").nth(10)).toContainText("número 90");
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
  const unique = `Comentário ${Date.now()}`;
  await page.goto("/article/97");
  await page.getByRole("button", { name: "Junta-te à conversa…" }).click();
  const form = page.locator("main form").first();

  await form.getByRole("button", { name: "Publicar" }).click();
  await expect(form.getByRole("alert")).toContainText("Escreve um comentário");

  await form.getByLabel("Comentário").fill("ERRO-SERVIDOR");
  await form.getByRole("checkbox").check();
  await form.getByRole("button", { name: "Publicar" }).click();
  await expect(form.getByRole("alert")).toContainText("Não foi possível publicar");
  await expect(form.getByLabel("Comentário")).toHaveValue("ERRO-SERVIDOR");

  await form.getByLabel("Comentário").fill(unique);
  await form.getByRole("checkbox").check();
  await form.getByRole("button", { name: "Publicar" }).click();
  await expect(page.getByText(unique, { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Junta-te à conversa…" })).toBeVisible();

  await page.getByRole("button", { name: "Responder" }).last().click();
  const replyForm = page.locator("main form", { has: page.getByRole("textbox", { name: "Resposta" }) });
  await replyForm.getByRole("textbox", { name: "Resposta" }).fill(`Resposta a ${unique}`);
  await replyForm.getByRole("checkbox").check();
  await replyForm.getByRole("button", { name: "Publicar" }).click();
  await expect(page.locator("p", { hasText: `Resposta a ${unique}` })).toBeVisible();

  await page.reload();
  await expect(page.getByText(unique, { exact: true })).toBeVisible();
});

test("theme persists across reload without a flash", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await page.getByRole("button", { name: /tema/ }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      (window as unknown as { __firstClass: string }).__firstClass = document.documentElement.className;
    });
  });
  await page.reload();
  expect(await page.evaluate(() => (window as unknown as { __firstClass: string }).__firstClass)).toContain("dark");
});

test("party navigation is always on screen and marks the current party", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("navigation", { name: "Partidos" }).getByRole("link", { name: /PSD/ }).click();
  await expect(page).toHaveURL(/\/partido\/psd$/);
  await expect(page.getByRole("navigation", { name: "Partidos" }).getByRole("link", { name: /PSD/ })).toHaveAttribute(
    "aria-current",
    "page",
  );
});

test("drawer works by keyboard", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Desktop shows the party sidebar instead of the drawer.");
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
  await drawer.getByRole("link", { name: /PSD/ }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/partido\/psd$/);
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

test("article page shows the excerpt and links to the original", async ({ page }) => {
  await page.goto("/article/100");
  const link = page.getByRole("link", { name: /Ler o artigo completo em Público/ });
  await expect(link).toHaveAttribute("href", "https://example.com/noticia/100");
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(page.locator("article p").first()).toContainText("…");
  await expect(page.getByRole("heading", { name: "Mais sobre PS" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Partilhar" }).first()).toBeVisible();
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

test("sitemap and robots are served", async ({ request }) => {
  const sitemap = await (await request.get("/sitemap.xml")).text();
  // News pages carry another outlet's text: out of the map and noindex. Our own pages are all in.
  expect(sitemap).not.toContain("/article/");
  expect(sitemap).toContain("/partido/cds-pp");
  expect(sitemap).toContain("/deputados/1100");
  expect(sitemap).toContain("/governo/00000000000000000000000000000001");
  expect(sitemap).toContain("/eleicoes/legislativas-2025/LOCAL-110000");
  expect(sitemap).toContain("/eleicoes/legislativas-2025/LOCAL-111100");
  expect(sitemap).toContain("/editorial/como-se-faz-uma-lei");
  expect(sitemap).toContain("/historia");
  expect(await (await request.get("/article/100")).text()).toMatch(/<meta name="robots" content="noindex, follow"/);
  expect(sitemap).toContain("/parlamento");
  expect(sitemap).toContain("/deputados");
  expect(sitemap).toContain("/governo");
  expect(sitemap).toContain("/eleicoes");
  expect(await (await request.get("/robots.txt")).text()).toContain("Sitemap:");
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
    "/deputados",
    "/deputados?partido=ps",
    "/deputados?deputado=1100",
    "/deputados/1100",
    "/governo",
    "/governo/00000000000000000000000000000001",
    "/eleicoes",
    "/eleicoes/legislativas-2025",
    "/eleicoes/legislativas-2025/LOCAL-010000",
    "/historia",
    "/editorial",
    "/editorial/a-maioria-que-nao-existe",
    "/editorial/o-que-muda-no-orcamento",
  ]) {
    test(`no accessibility violations: ${path} (${colorScheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      await page.goto(path);
      await expect(page.locator("main")).toBeVisible();
      await noSeriousA11yIssues(page);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      expect(overflow).toBe(false);
    });
  }
}

test("comments use >>number to quote, with a preview and a jump", async ({ page }) => {
  const unique = `Citação ${Date.now()}`;
  await page.goto("/article/96");
  await page.getByRole("button", { name: "Junta-te à conversa…" }).click();
  const form = page.locator("main form").first();
  await form.getByLabel("Comentário").fill(`Primeiro ${unique}`);
  await form.getByRole("checkbox").check();
  await form.getByRole("button", { name: "Publicar" }).click();
  const first = page.locator("article", { hasText: `Primeiro ${unique}` });
  await expect(first).toBeVisible();
  const number = (await first.getAttribute("id"))!.replace("comentario-", "");

  await first.getByRole("button", { name: `No.${number}, citar este comentário` }).click();
  const quoteForm = page.locator("main form").first();
  await expect(quoteForm.getByLabel("Comentário")).toHaveValue(`>>${number}\n`);
  await quoteForm.getByLabel("Comentário").pressSequentially(`Segundo ${unique}`);
  await quoteForm.getByRole("checkbox").check();
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
  const name = (await first.locator("span").first().textContent())!;
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

  const initiatives = page.getByRole("region", { name: "Iniciativas" });
  await initiatives.getByRole("button", { name: "Ver votação por partido" }).first().click();
  await expect(initiatives.getByText("A favor").first()).toBeVisible();
  await initiatives.getByRole("button", { name: /Em discussão/ }).click();
  await expect(initiatives.getByText("Em discussão", { exact: true }).first()).toBeVisible();
  await initiatives.getByRole("button", { name: "Carregar mais" }).click();
  await expect(initiatives.getByRole("article")).toHaveCount(18);
});

test("deputies: filter by party, open a deputy's summary, then their full profile", async ({ page }) => {
  await page.goto("/deputados?partido=ps");
  await expect(page.getByRole("heading", { level: 1, name: "Deputados do PS" })).toBeVisible();
  const list = page.getByRole("list", { name: "Deputados" });
  await expect(list.getByRole("listitem")).toHaveCount(58);

  // Pressing a deputy opens their summary in a card, and the address keeps the choice.
  const first = list.getByRole("button").first();
  const name = (await first.locator("span span").first().textContent())!;
  await first.click();
  await expect(page).toHaveURL(/deputado=\d+$/);
  const card = page.getByRole("region", { name });
  await expect(card.getByRole("tab", { name: "Votações" })).toBeVisible();

  // Searching narrows the grid.
  await card.getByRole("button", { name: "Fechar" }).click();
  await page.getByRole("searchbox", { name: "Procurar deputado" }).fill(name);
  await expect(list.getByRole("listitem")).toHaveCount(1);

  await list.getByRole("button").first().click();
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
  const table = page.getByRole("list", { name: /Lugares à mesa do Conselho de Ministros/ });
  await table.getByRole("button", { name: /Henrique Valadares/ }).click();
  await expect(page).toHaveURL(/membro=0+1$/);
  const card = page.getByRole("region", { name: "Henrique Valadares" });
  await expect(card.getByRole("link", { name: /Percurso e notícias/ })).toBeVisible();
  await card.getByRole("button", { name: "Fechar" }).click();
  await expect(page.getByText("Carrega numa pessoa à mesa")).toBeVisible();

  await page.getByRole("link", { name: /Eleito deputado pelo PSD/ }).click();
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

  // The latest election is featured at the top, and also listed with the others.
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

test("elections: unknown elections, places and bodies are real 404s", async ({ request }) => {
  expect((await request.get("/eleicoes/legislativas-1900")).status()).toBe(404);
  expect((await request.get("/eleicoes/legislativas-2025/LOCAL-999999")).status()).toBe(404);
  expect((await request.get("/eleicoes/legislativas-2025/nada")).status()).toBe(404);
  expect((await request.get("/eleicoes/legislativas-2025?orgao=CM")).status()).toBe(404);
});

test("parties can be ordered by votes, and the choice survives a reload", async ({ page, isMobile }) => {
  await page.goto("/");
  const nav = isMobile
    ? page.getByRole("navigation", { name: "Partidos" })
    : page.locator("aside").getByRole("navigation", { name: "Partidos" });
  const first = nav.getByRole("link").filter({ hasNotText: "Todas" }).first();
  await expect(first).toContainText("B.E.");
  await nav.getByRole("button", { name: "Votos" }).click();
  await expect(nav.getByRole("button", { name: "Votos" })).toHaveAttribute("aria-pressed", "true");
  await expect(first).toContainText("PSD");
  await page.reload();
  await expect(first).toContainText("PSD");
  await nav.getByRole("button", { name: "A–Z" }).click();
  await expect(first).toContainText("B.E.");
});

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
  await expect(page.getByRole("region", { name: "Votações do PS" }).getByRole("listitem").first()).toBeVisible();
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
  await expect(page.getByRole("heading", { level: 3, name: "Anos 70" })).toBeVisible();

  const current = page.getByRole("article", { name: "Henrique Valadares" }).first();
  await expect(current.getByText("Em funções")).toBeVisible();
  // A kind of event the site doesn't know yet is left out.
  await expect(page.getByText("Um tipo que o site ainda não conhece")).toHaveCount(0);
  await expect(page.getByText("Teresa Albuquerque toma posse como Presidente da República")).toBeVisible();

  await page.getByRole("link", { name: "Ver resultados →" }).first().click();
  await expect(page).toHaveURL(/\/eleicoes\/legislativas-2025$/);
  await page.goBack();
  await page.getByRole("link", { name: "Quem governa agora →" }).click();
  await expect(page).toHaveURL(/\/governo$/);
});

test("blog: featured posts on the front page, the list by kind, and a post rendered safely", async ({ page }) => {
  await page.goto("/");
  const highlights = page.getByRole("region", { name: "Destaques" });
  await expect(highlights.getByRole("listitem")).toHaveCount(3);
  await highlights.getByRole("link", { name: "A maioria que não existe" }).click();
  await expect(page).toHaveURL(/\/editorial\/a-maioria-que-nao-existe$/);
  await expect(page.getByRole("heading", { level: 1, name: "A maioria que não existe" })).toBeVisible();
  await expect(page.getByText(/Texto de opinião: vincula apenas Tomás Varela/)).toBeVisible();
  // Raw HTML shows as text, a script link stays plain text, and a player from an unknown host is dropped.
  await expect(page.getByText("<script>window.__xssPost=1</script>", { exact: false })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __xssPost?: number }).__xssPost)).toBeUndefined();
  await expect(page.getByRole("link", { name: "um link perigoso" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "um bom" })).toHaveAttribute("href", "https://www.parlamento.pt");
  await expect(page.locator("iframe")).toHaveCount(0);
  const ld = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent())!);
  expect(ld).toMatchObject({ "@type": "OpinionNewsArticle", headline: "A maioria que não existe" });

  await page.goto("/editorial?tipo=podcast");
  await expect(page.getByRole("heading", { level: 2 })).toHaveCount(1);
  await page.getByRole("link", { name: "Orçamento do Estado: o que muda?" }).click();
  await expect(page.locator('iframe[src^="https://open.spotify.com/embed/"]')).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Neste episódio" })).toBeVisible();

  expect((await page.goto("/editorial/nao-existe"))!.status()).toBe(404);
});
