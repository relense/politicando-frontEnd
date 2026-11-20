import { expect, test } from "@playwright/test";
import { gotoReady, noSeriousA11yIssues, signUp } from "./helpers";

// Each walks several pages, with an accessibility scan and an account: more than the default 30 s on a slow run.
test.describe.configure({ timeout: 60_000 });

/** For a look at the pages next to the designs: set SHOTS to a folder. */
const shot = async (page: import("@playwright/test").Page, name: string, isMobile: boolean) => {
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/${name}-${isMobile ? "phone" : "desk"}.png`, fullPage: true });
};

test("ideas board: search before proposing, the tabs and filters, what's done, and voting needs an account", async ({ page, isMobile }) => {
  // The old addresses land on the board, the main page of Feedback.
  await page.goto("/forum/ideias");
  await expect(page).toHaveURL(/\/feedback$/);
  await expect(page.getByRole("heading", { level: 1, name: "O que queres ver no Politicando?" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Entra para votar e propor" })).toBeVisible();

  const list = page.getByRole("list", { name: "Lista de ideias" }).locator(":scope > li");
  await expect(list.first()).toContainText("Votações na especialidade do Orçamento do Estado, à lupa");
  await expect(list.first()).toContainText("Resposta da equipa");
  await expect(list.first()).toContainText("Em desenvolvimento");
  // A reply in the last hour.
  await expect(list.first()).toContainText("a discutir agora");
  await expect(page.getByRole("region", { name: "Feito a pedido vosso" })).toContainText("Filtro por partido nas notícias");
  await noSeriousA11yIssues(page);

  // A search first: ideas already there, to vote on instead of repeating.
  await page.getByRole("searchbox", { name: "Tens uma ideia ou encontraste um problema?" }).fill("votações orçamento");
  const similar = page.getByRole("list", { name: "Ideias parecidas" }).getByRole("listitem");
  await expect(similar.first()).toContainText("Votações na especialidade do Orçamento do Estado, à lupa");
  await expect(page.getByText(/ideias parecidas · vota em vez de repetir/)).toBeVisible();
  await shot(page, "board", isMobile);
  await expect(page.getByRole("link", { name: /Criar nova ideia/ })).toHaveAttribute(
    "href",
    "/feedback/nova?titulo=vota%C3%A7%C3%B5es%20or%C3%A7amento",
  );
  // Voting needs an account: the login note opens instead.
  await page
    .getByRole("button", { name: /^Votar em «Alertas quando um deputado do meu distrito vota»/ })
    .first()
    .click();
  await expect(page.getByRole("dialog", { name: "Apoia esta ideia" })).toBeVisible();
  await page.keyboard.press("Escape");

  // The filters: what's done takes no more votes.
  await page.getByRole("navigation", { name: "Filtrar por estado" }).getByRole("link", { name: "Feitas" }).click();
  await expect(page).toHaveURL(/estado=feitas/);
  await expect(list).toHaveCount(3);
  await expect(list.first().getByRole("button", { name: /Votar em/ })).toBeDisabled();
  await page.getByRole("navigation", { name: "Ordenar ideias" }).getByRole("link", { name: "Novas" }).click();
  await expect(page).toHaveURL(/ordem=novas&estado=feitas/);

  // With an account, a vote counts once.
  await signUp(page);
  await gotoReady(page, "/feedback");
  await expect(page.getByRole("region", { name: "Entra para votar e propor" })).toHaveCount(0);
  const vote = page.getByRole("button", { name: /^Votar em «Modo de leitura sem imagens, para poupar dados», (\d+) votos$/ });
  const before = Number((await vote.getAttribute("aria-label"))!.match(/(\d+) votos/)![1]);
  await vote.click();
  await expect(
    page.getByRole("button", { name: `Votaste em «Modo de leitura sem imagens, para poupar dados», ${before + 1} votos` }),
  ).toBeDisabled();
});

test("an idea: the team's pinned answer, the timeline, similar ideas, the best comments and a vote on one", async ({ page, isMobile }) => {
  await gotoReady(page, "/feedback/ideias/501");
  await expect(page.getByRole("heading", { level: 1, name: "Votações na especialidade do Orçamento do Estado, à lupa" })).toBeVisible();
  await expect(page.getByRole("region", { name: /Resposta da equipa · fixada/ })).toContainText("Vai ser a página Orçamento do Estado");
  const timeline = page.getByRole("list", { name: "Estado da ideia" });
  await expect(timeline.locator('[aria-current="step"]')).toContainText("A fazer");
  await expect(timeline).toContainText(/previsto \d\d-\d\d/);
  await expect(page.getByRole("region", { name: "Sobre esta ideia" })).toContainText("23");
  await expect(page.getByRole("region", { name: "Ideias parecidas" })).toContainText("Votações de cada partido no Orçamento");

  // Most voted first; the team's reply under the comment it answers.
  const comments = page.getByRole("region", { name: "Comentários" });
  await expect(comments.getByRole("article").first()).toContainText("miguel.s");
  const team = comments.getByRole("article", { name: "Comentário de Politicando" });
  await expect(team).toContainText("EQUIPA");
  await expect(comments.getByRole("list", { name: "Respostas a miguel.s" })).toContainText("Vai haver um filtro");
  await expect(comments.getByText(/^\d+ comentários$/)).toBeVisible();
  await noSeriousA11yIssues(page);
  await shot(page, "idea", isMobile);

  // Voting on a comment needs an account; with one it counts once.
  await signUp(page);
  await gotoReady(page, "/feedback/ideias/501");
  // The mock keeps votes between runs: read the count first.
  const ana = page.getByRole("button", { name: /^Votar no comentário de ana\.r, \d+ votos$/ });
  const votes = Number((await ana.getAttribute("aria-label"))!.match(/(\d+) votos/)![1]);
  await ana.click();
  await expect(page.getByRole("button", { name: `Votaste no comentário de ana.r, ${votes + 1} votos` })).toBeDisabled();
  await page.getByRole("button", { name: "Recentes" }).click();
  await expect(page.getByRole("button", { name: "Recentes" })).toHaveAttribute("aria-pressed", "true");
  // A comment, from the box above them.
  const text = `Também queria ver as propostas por artigo (${Date.now()}).`;
  await page.getByRole("textbox", { name: "Comentário" }).fill(text);
  await page.getByRole("button", { name: "Comentar" }).click();
  await expect(comments.getByText(text)).toBeVisible();

  // A duplicate points to the original.
  await gotoReady(page, "/feedback/ideias/509");
  await expect(page.getByText("Já foi sugerida:")).toBeVisible();
  await expect(page.getByRole("link", { name: "Votações na especialidade do Orçamento do Estado, à lupa" }).first()).toHaveAttribute(
    "href",
    "/feedback/ideias/501",
  );
});

test("propose an idea: similar ones first, the text kept while logging in, then on the board", async ({ page, isMobile }) => {
  await gotoReady(page, "/feedback/nova?titulo=Newsletter%20di%C3%A1ria");
  await expect(page.getByRole("heading", { level: 1, name: "Propor uma ideia" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Título" })).toHaveValue("Newsletter diária");
  // Before posting: these look alike, vote instead.
  const alike = page.getByRole("region", { name: "Ideias parecidas" });
  await expect(alike).toContainText("Newsletter diária curta, em vez de semanal");
  await expect(alike.getByRole("button", { name: /É esta · votar em «Newsletter diária curta/ })).toBeDisabled();
  await page.getByRole("textbox", { name: "Título" }).fill("Modo escuro no email da newsletter");
  await page.getByRole("textbox", { name: "Porque seria útil?" }).fill("Leio a newsletter à noite e o email claro encandeia.");
  await page.getByRole("combobox", { name: /Em que parte do site/ }).selectOption("Newsletter");
  await noSeriousA11yIssues(page);
  await shot(page, "nova", isMobile);
  // Without an account: the login note, and the text stays on the device.
  await page.getByRole("button", { name: "Publicar ideia →" }).click();
  await expect(page.getByRole("dialog", { name: "Propõe a tua ideia" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Porque seria útil?" })).toHaveValue(
    "Leio a newsletter à noite e o email claro encandeia.",
  );

  await signUp(page);
  await gotoReady(page, "/feedback/nova");
  await expect(page.getByRole("textbox", { name: "Título" })).toHaveValue("Modo escuro no email da newsletter");
  await expect(page.getByText(/^Publicas como/)).toBeVisible();
  await page.getByRole("button", { name: "Publicar ideia →" }).click();
  await expect(page).toHaveURL(/\/feedback\/ideias\/\d+$/);
  await expect(page.getByRole("heading", { level: 1, name: "Modo escuro no email da newsletter" })).toBeVisible();
  await expect(page.getByText(/proposta a .* · Newsletter/)).toBeVisible();
  await expect(page.getByRole("list", { name: "Estado da ideia" }).locator('[aria-current="step"]')).toContainText("Proposta");
  // The draft is gone once published.
  await gotoReady(page, "/feedback/nova");
  await expect(page.getByRole("textbox", { name: "Título" })).toHaveValue("");
});
