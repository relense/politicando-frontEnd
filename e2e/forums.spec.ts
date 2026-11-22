import { expect, test } from "@playwright/test";
import { noSeriousA11yIssues, signUp } from "./helpers";

test("forum index lists the general board first, then the parties", async ({ page }) => {
  await page.goto("/forum");
  await expect(page.getByRole("heading", { level: 1, name: "Fórum" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Fórum geral" }).getByRole("link")).toHaveCount(1);
  await expect(
    page.getByRole("list", { name: "Fóruns dos partidos" }).getByRole("link", { name: /PS · Partido Socialista/ }),
  ).toBeVisible();
  await noSeriousA11yIssues(page);
  await page.getByRole("link", { name: /Geral/ }).first().click();
  await expect(page).toHaveURL(/\/forum\/geral$/);
});

test("board lists threads with the pinned one first, and hostile text stays text", async ({ page }) => {
  await signUp(page);
  await page.goto("/forum/geral");
  await expect(page.getByRole("heading", { level: 1, name: "Fórum geral" })).toBeVisible();
  const threads = page.getByRole("list", { name: "Discussões" }).getByRole("listitem");
  await expect(threads.first()).toContainText("Fixada");
  await expect(page.getByRole("link", { name: /<script>window.__forumXss=1<\/script>/ })).toBeVisible();
  expect(await page.evaluate(() => "__forumXss" in window)).toBe(false);
  await expect(page.getByRole("link", { name: /Notícia: Notícia de teste número 100/ })).toBeVisible();
  await noSeriousA11yIssues(page);

  // Votes count on every board; with none yet, the most replies go first.
  await page.getByRole("link", { name: "Mais votadas" }).click();
  await expect(page).toHaveURL(/ordem=votadas/);
  await expect(threads.nth(1)).toContainText("O que acham do debate do orçamento?");
  await threads
    .nth(1)
    .getByRole("button", { name: /^Votar em «O que acham do debate do orçamento\?»/ })
    .click();
  await expect(threads.nth(1).getByRole("button", { name: /^Votaste em/ })).toBeDisabled();
});

test("unknown board is a 404 and a thread on the wrong board moves to the right one", async ({ page }) => {
  const response = await page.goto("/forum/nao-existe");
  expect(response?.status()).toBe(404);
  await page.goto("/forum/ps/8");
  await expect(page).toHaveURL(/\/forum\/geral\/8$/);
});

test("thread shows the OP, replies, quotes and removed posts, and takes a reply", async ({ page }, testInfo) => {
  await signUp(page);
  const text = `Resposta de teste no fórum (${testInfo.project.name})`;
  await page.goto("/forum/geral/8");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await expect(page.getByRole("heading", { level: 1, name: "O que acham do debate do orçamento?" })).toBeVisible();
  await expect(page.getByText("Removido pela moderação")).toBeVisible();
  await expect(page.getByRole("link", { name: "https://example.org/orcamento" })).toHaveAttribute("rel", "nofollow ugc noopener");
  const reply33 = page.getByRole("article", { name: /Resposta 33/ });
  await expect(reply33.getByRole("link", { name: ">>31" })).toHaveAttribute("href", "#post-31");
  // The OP replied as 34, so it carries the OP badge.
  await expect(page.getByRole("article", { name: /Resposta 34/ }).getByText("OP", { exact: true })).toBeVisible();
  await noSeriousA11yIssues(page);

  await reply33.getByRole("button", { name: "Responder" }).click();
  const field = page.getByRole("textbox", { name: "Resposta" });
  await expect(field).toBeFocused();
  await expect(field).toHaveValue(/^>>33\n/);
  await field.pressSequentially(text);
  await page.getByRole("button", { name: "Publicar" }).click();
  const mine = page.getByRole("article").filter({ hasText: text });
  await expect(mine).toBeVisible();
  await expect(mine.getByText("(tu)")).toBeVisible();
  await expect(field).toHaveValue("");
});

test("a locked thread has no reply form", async ({ page }) => {
  await page.goto("/forum/geral/7");
  await expect(page.getByText("Esta discussão foi fechada pela moderação")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Resposta" })).toHaveCount(0);
});

test("reporting a post asks for a reason and thanks the reader", async ({ page }) => {
  await signUp(page);
  await page.goto("/forum/geral/8");
  const post = page.getByRole("article", { name: /Resposta 31/ });
  await post.getByRole("button", { name: "Denunciar" }).click();
  const send = post.getByRole("button", { name: "Enviar denúncia" });
  await expect(send).toBeDisabled();
  await post.getByLabel("Spam ou publicidade").check();
  await send.click();
  await expect(post.getByRole("status")).toContainText("Obrigado, vamos rever");
});

test("an article opens a new thread on its party's board, linked to it", async ({ page }) => {
  await signUp(page);
  await page.goto("/article/100");
  const link = page.getByRole("link", { name: /^Discutir no fórum do / }).first();
  await expect(link).toHaveAttribute("href", /\/forum\/[a-z-]+\?artigo=100#nova/);
  await page.goto("/forum/ps?artigo=100#nova");
  const form = page.getByRole("form", { name: /Nova discussão/ });
  await expect(form.getByText("Sobre a notícia")).toBeVisible();
  await noSeriousA11yIssues(page);
  await form.getByLabel("Título").fill("Discussão de teste sobre a notícia");
  await form.getByLabel("Texto").fill("Primeira mensagem.");
  await form.getByRole("button", { name: "Publicar discussão" }).click();
  await expect(page).toHaveURL(/\/forum\/ps\/\d+$/);
  await expect(page.getByRole("heading", { level: 1, name: "Discussão de teste sobre a notícia" })).toBeVisible();
  await expect(page.locator("#op").getByText("(tu)")).toBeVisible();
  await expect(page.getByRole("link", { name: /Notícia de teste número 100/ })).toHaveAttribute("href", "/article/100");
  // The author's own vote counts: on the board it's already theirs, and there's no undo.
  await page.goto("/forum/ps");
  await expect(page.getByRole("button", { name: "Votaste em «Discussão de teste sobre a notícia», 1 voto" }).first()).toBeDisabled();
});

test("an article comment can be reported", async ({ page }) => {
  await signUp(page);
  await page.goto("/article/100");
  const report = page.getByRole("button", { name: "Denunciar" }).first();
  test.skip((await report.count()) === 0, "This article has no comments in the mocks");
  await report.click();
  await page.getByLabel("Insulto ou assédio").first().check();
  await page.getByRole("button", { name: "Enviar denúncia" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Obrigado, vamos rever" })).toBeVisible();
});
